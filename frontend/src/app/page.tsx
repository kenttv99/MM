import React from 'react';
import Header from '@/components/Header';
import Registration from '@/components/Registration';
import Events from '@/components/Events';
import Media from '@/components/Media';
import Footer from '@/components/Footer';

export default function PublicHomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      {/* Главный контент с отступом для фиксированного хедера */}
      <main className="flex-grow flex flex-col justify-start items-center pt-20">
        <Registration />
        <Events />
        <Media />
        
        {/* Секция с преимуществами */}
        <section className="w-full py-20 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Почему <span className="text-blue-600">Moscow Mellows</span>?</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Наша платформа предлагает уникальный опыт участия в городских мероприятиях и помогает находить интересные события для каждого.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gray-50 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-5">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Актуальные события</h3>
                <p className="text-gray-600">
                  Наша платформа всегда содержит актуальную информацию о предстоящих мероприятиях в городе.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-5">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Удобная покупка билетов</h3>
                <p className="text-gray-600">
                  Приобретайте билеты онлайн быстро и безопасно, без необходимости посещать кассы.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-5">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Сообщество единомышленников</h3>
                <p className="text-gray-600">
                  Знакомьтесь с интересными людьми, расширяйте круг общения и находите новых друзей.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA секция */}
        <section className="w-full py-16 bg-blue-600 text-white">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold mb-6">Готовы присоединиться?</h2>
            <p className="text-blue-100 max-w-2xl mx-auto mb-8">
              Создайте аккаунт сегодня и откройте для себя мир московских мероприятий. Регистрация занимает всего пару минут!
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button className="px-8 py-3 bg-white text-blue-600 font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
                Создать аккаунт
              </button>
              <button className="px-8 py-3 bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg border border-blue-400 transition-all duration-300 transform hover:-translate-y-0.5">
                Узнать больше
              </button>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}