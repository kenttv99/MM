import React from 'react';
import Header from '@/components/Header';
import Registration from '@/components/Registration';
import Events from '@/components/Events';
import Media from '@/components/Media';
import Footer from '@/components/Footer';

export default function PublicHomePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen flex flex-col justify-start items-center pb-20">
        <Registration />
        <Events />
        <Media />
      </main>
      <Footer />
    </>
  );
}