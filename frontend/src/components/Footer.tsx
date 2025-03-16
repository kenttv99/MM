import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white pt-6 pb-6 shadow-inner">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center">
          <p className="text-black text-sm">© Moscow Mellows {new Date().getFullYear()}. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;