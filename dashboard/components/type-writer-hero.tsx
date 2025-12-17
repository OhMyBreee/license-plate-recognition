import { TypingAnimation } from "@/components/ui/typing-animation"

export function Type_writer_hero() {
  return (
    <div>
        <TypingAnimation
          words={["License Plate Recognizer"]}
          cursorStyle="block"
          loop
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground"
        />
      </div>
  )
}
