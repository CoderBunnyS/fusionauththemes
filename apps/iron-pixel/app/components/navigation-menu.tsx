'use client';
import { Button } from '@/components/ui/button';
import { useFusionAuth } from '@fusionauth/react-sdk';
import Image from 'next/image';
import Link from 'next/link';

export function NavigationMenu() {
  const {
    isLoggedIn,
    isFetchingUserInfo,
    startLogin,
    startRegister,
    userInfo,
  } = useFusionAuth();

  return (
    <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="relative w-8 h-8">
              <Image
                src="/LogoIcon_Gradient.svg"
                alt="Iron Pixel Studios Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-white font-bold">IRON PIXEL STUDIOS</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/" className="text-gray-300 hover:text-white">
              Games
            </Link>
            <Link href="/" className="text-gray-300 hover:text-white">
              About
            </Link>
            <Link href="/" className="text-gray-300 hover:text-white">
              News
            </Link>
            <Link href="/" className="text-gray-300 hover:text-white">
              Support
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            {!isLoggedIn && (
              <>
                <Button
                  variant="ghost"
                  className="text-white"
                  onClick={() => startLogin()}
                >
                  Sign In
                </Button>
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600"
                  onClick={() => startRegister()}
                >
                  Register
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
