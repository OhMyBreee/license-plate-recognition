// import { NextResponse } from "next/server";
// import { createClient } from "@/lib/supabase/server";
// import { InferenceSession, Tensor } from "onnxruntime-node";

// export async function POST(req: Request) {
//   const supabase = createClient();
//   const { data: userData } = await supabase.auth.getUser();
//   if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//   const { image } = await req.json();
//   const buffer = Buffer.from(image, "base64");

//   // load YOLO model once (add caching)
//   const session = await InferenceSession.create("./models/yolo.onnx");

//   // preprocess → run → postprocess
//   const detections = await runYolo(session, buffer);

//   // choose best plate
//   const best = detections[0];

//   // Insert record in db
//   const { error } = await supabase.from("detections").insert({
//     user_id: userData.user.id,
//     plate: best.plate,
//     confidence: best.confidence,
//     metadata: best,
//   });

//   return NextResponse.json(best);
// }
