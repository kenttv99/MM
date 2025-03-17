"use client"

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import PartnerButton from './PartnerButton';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  // Эффект для отслеживания скролла
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out
        ${isScrolled ? 'bg-white/95 backdrop-blur-sm shadow-lg py-3' : 'bg-white/90 py-4'}`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="transition-transform duration-300 hover:scale-105">
          <Logo />
        </Link>
        
        <PartnerButton />
      </div>
    </header>
  );
};

export default Header;