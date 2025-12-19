import time
import io
import os
import cv2
import numpy as np
import requests
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.responses import FileResponse
import cv2, io, time, threading, queue
from supabase import create_client

SUPABASE_URL = "https://pnohjbvezfryehxsvdcw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBub2hqYnZlemZyeWVoeHN2ZGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Njc0MjUsImV4cCI6MjA4MDQ0MzQyNX0.bviKTc6Th4PueavYydmeMOReJ-koySlZmtS1M4mOYXY"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class PlateItem(BaseModel):
    plate: str

# ===========================
# CONFIG
# ===========================

BLYNK_TOKEN = "9o8KBxkWAI4nvtVNCgmobSKwKEf14eBF"

VPIN_PLATE = "V0"
VPIN_MATCH_LED = "V1"
VPIN_MATCH_STATUS = "V2"
VPIN_WIFI_LED = "V3"

WATCHLIST = {""}

# ===========================
# LOAD MODELS
# ===========================

plate_detector = YOLO("LPR_MODEL.pt")
char_detector = YOLO("OCR_MODEL.pt")

# ===========================
# GLOBAL STATUS STATE
# ===========================

last_status = {
    "plate": "---",
    "match": False,
    "updated": False
}

# ===========================
# FASTAPI
# ===========================

app = FastAPI()
os.makedirs("saved_images", exist_ok=True)
app.mount("/images", StaticFiles(directory="saved_images"), name="images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

img_queue = queue.Queue(maxsize=2)

# last recog result
last_status = {
    "plate": "",
    "match": False,
    "updated": False
}

# ===========================
# WATCHLIST CRUD
# ===========================

WATCHLIST = set()

def refresh_watchlist():
    global WATCHLIST
    result = supabase \
        .from_("watch_list") \
        .select("plate_number") \
        .execute()
    
    WATCHLIST = {row["plate_number"].upper() for row in result.data}

# call at startup
refresh_watchlist()

# refresh every 60 seconds (async safe)
def auto_refresh_watchlist():
    while True:
        refresh_watchlist()
        time.sleep(60)

threading.Thread(target=auto_refresh_watchlist, daemon=True).start()


# ===========================
# BLYNK UPDATE
# ===========================

def blynk_update(pin, value):
    try:
        requests.get(
            "https://blynk.cloud/external/api/update",
            params={"token": BLYNK_TOKEN, pin: value},
            timeout=2
        )
    except:
        pass

def send_to_blynk(plate, is_match):
    blynk_update(VPIN_PLATE, plate)
    blynk_update(VPIN_MATCH_LED, int(is_match))
    blynk_update(VPIN_MATCH_STATUS, "MATCH" if is_match else "NO MATCH")
    blynk_update(VPIN_WIFI_LED, 1)

# ===========================
# ROOT
# ===========================

@app.get("/")
def root():
    return {"status": "ESP32 LPR backend running"}

# ===========================
# ESP32 UPLOAD ONLY
# ===========================

latest_frame = None
latest_image_path = "saved_images/latest.jpg"

@app.post("/recognize")
async def recognize(request: Request):

    img_bytes = await request.body()
    if not img_bytes:
        return {"status": "error", "msg": "no data"}

    # decode image only to save for UI
    pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    # save latest image
    cv2.imwrite(latest_image_path, img)

    # push to YOLO queue, drop old frames
    if img_queue.full():
        img_queue.get()
    img_queue.put(img)

    return {"status": "ok"}

def yolo_worker():
    global last_status

    while True:
        img = img_queue.get()  # waits for frame

        results = plate_detector(img, conf=0.2, verbose=False)
        boxes = results[0].boxes

        if not boxes:
            last_status = {
                "plate": "NO PLATE",
                "match": False,
                "updated": True
            }
            send_to_blynk("NO PLATE", False) 
            continue

        # pick biggest or most chars
        best = None
        best_len = 0

        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            crop = img[y1:y2, x1:x2]

            ocr = char_detector(crop, conf=0.25, verbose=False)

            chars = sorted(
                (
                    (int(c.xyxy[0][0]), "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[int(c.cls[0])])
                    for c in ocr[0].boxes
                ),
                key=lambda x: x[0]
            )

            plate_txt = "".join(c for _, c in chars)

            if len(plate_txt) > best_len:
                best = plate_txt
                best_len = len(plate_txt)

        is_match = best.upper() in WATCHLIST

        last_status = {
            "plate": best if best else "---",
            "match": is_match,
            "updated": True
        }
        send_to_blynk(last_status["plate"], is_match)

threading.Thread(target=yolo_worker, daemon=True).start()

# ===========================
# ESP32 STATUS POLLING
# ===========================

@app.get("/status")
def status_json():
    """
    This endpoint returns the most recent recognition result.
    ESP32 will poll this every few seconds.
    """
    return {
        "plate": last_status.get("plate", "---"),
        # "plate": "A1721FQ",
        "match": last_status.get("match", False)
    }

@app.get("/status/json")
def status_json():
    return last_status

@app.get("/latest")
def get_latest_image():
    return FileResponse("saved_images/latest.jpg")



# ===========================
# RUN SERVER
# ===========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
