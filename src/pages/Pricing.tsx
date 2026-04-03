import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';

const Pricing = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Upgrade to ThirstyGrass Pro
          </h1>
          <p className="text-muted-foreground text-lg">
            Coming soon — payment setup in progress.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
