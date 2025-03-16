import React from 'react';
import Header from '@/components/Header';
import Container1 from '@/components/Registration';
import Container2 from '@/components/Events';
import Container3 from '@/components/Media';
import Footer from '@/components/Footer';

const HomePage = () => {
  return (
    <>
      <Header />
      <main className="min-h-screen flex flex-col justify-start items-center pb-20">
        <Container1 />
        <Container2 />
        <Container3 />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;