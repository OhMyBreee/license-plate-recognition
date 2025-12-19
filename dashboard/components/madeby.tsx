"use client";

import { cn } from "@/lib/utils";
import { Marquee } from "@/components/ui/marquee"
import Image from 'next/image';
const skills = [
  { name: "Bryan Santosa" },
  // { name: "Alan Ganteng"},
//   { name: "Carlson Othello Hou"},
  // { name: "Kinsley Tan"},
  { name: "Luther Ferdinand"},
  { name: "Kent"},
  { name: "Hosea Jonathan"},
//  { name: "Bob the builder"},
//  { name: "Ilham God"},
];

const ReviewCard = ({
  name
}: {
  name: string
}) => {
  return (
    <figure
  onClick={() =>
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" })
  }
  className={cn(
  "flex items-center gap-3 px-2 md:px-3 lg:px-5 py-1 md:py-1 rounded-full cursor-pointer transition-all duration-300",
  "backdrop-blur-xl bg-white/10 border border-white/30 shadow text-xs md:text-sm lg:text-base text-white",
  "hover:bg-white/20 hover:scale-[1.04] hover:shadow-[0_0_25px_#FFA50040]"
)}
>
  <figcaption className="capitalize whitespace-nowrap md:whitespace-normal">{name}</figcaption>
</figure>

  )
}

export default function Madeby() {
  return (
    <section
      id="skills"
      className=" text-white max-w-[150px] md:max-w-[400px] lg:max-w-[600px]"
    >
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden
      [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
        <Marquee reverse pauseOnHover className="[--duration:15s]">
            {skills.map((skill) => (
              <ReviewCard key={skill.name} {...skill} />
            ))}
        </Marquee>
      </div>
    </section>
  );
}