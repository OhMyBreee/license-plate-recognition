"use client";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { CircleCheckIcon, CircleHelpIcon, CircleIcon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import Link from "next/link"
import { ModeToggle }from "@/components/color-mode"
import { Button } from "@/components/ui/button"
import Image from "next/image";
import { useTheme } from 'next-themes';
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { AuthButton } from "./auth-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react";
import { GreetUser } from "./greetuser";
export default function Navbar() {
  const isMobile = useIsMobile()
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  const logoSrc = resolvedTheme === 'dark' ? '/Logo.png' : '/Logo-dark.png';
  return (
    <div className = "w-full  flex justify-between items-center px-8 lg:px-16 py-4 backdrop-blur-sm top-0 z-10 sticky">
    {/* // <div> */}
    <Button variant="ghost">
        <Link href = "/#hero">
          <Image 
              src={logoSrc}
              alt="Logo"
              width={40}       // adjust size
              height={40}
              className="select-none"
              />
        </Link>
    </Button>
    {/* DESKTOP MENU */}
      <div className="hidden md:block">
        <NavigationMenu>
          <NavigationMenuList className="flex-wrap text-foreground">

            <NavigationMenuItem>
              <NavigationMenuTrigger>Inference</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="gap-2 py-2 px-2">
                  <ListItem href="/inference" title="Introduction">
                    Re-usable components built using Radix UI and Tailwind CSS.
                  </ListItem>
                  <ListItem href="/inference" title="Installation">
                    How to install dependencies and structure your app.
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <AuthButton />
            </NavigationMenuItem>

            <NavigationMenuItem>
              <ModeToggle />
            </NavigationMenuItem>

          </NavigationMenuList>
        </NavigationMenu>
      </div>

      {/* MOBILE MENU */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className = "w-[40px] h-[40px] p-0">
              <Menu size={40} strokeWidth={3} className = "w-fit h-fit" />
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-64 p-4">
            <SheetHeader className="">
              <SheetTitle className = "flex justify-between pt-5">
                <div className="w-full h-full  flex items-center">Menu</div>
              <ModeToggle variant = "ghost" />
              </SheetTitle>
              <SheetDescription>
                <GreetUser></GreetUser>
              </SheetDescription>
            </SheetHeader>

            {/* <div className="flex flex-col space-y-4 mt-4 p-4">

              <h2 className="text-lg font-semibold">Menu</h2> */}
              <Button variant = "ghost" className = "justify-start">
                <Link href="/inference" className="text-sm ">
                  Inference
                </Link>
              </Button>
              <Button variant = "ghost" className = "justify-start">
                <Link href="/auth/login" className="text-sm ">
                  Sign in 
                </Link>
              </Button>
              <Button variant = "ghost" className = "justify-start">
                <Link href="/auth/sign-up" className="text-sm ">
                  Sign up
                </Link>
              </Button>


            {/* </div> */}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  )
}