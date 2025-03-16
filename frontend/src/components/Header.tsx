import React from 'react';
import Link from 'next/link';
import Logo from './Logo';
import PartnerButton from './PartnerButton';

const Header = () => {
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-white shadow-md sticky top-0 z-50">
      <Link href="/">
        <Logo />
      </Link>
      <PartnerButton />
    </header>
  );
};

export default Header;