import React from 'react';
import Link from 'next/link';

const PartnerButton = () => {
  return (
    <Link href="/partner">
      <a className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out">
        Стать партнером
      </a>
    </Link>
  );
};

export default PartnerButton;