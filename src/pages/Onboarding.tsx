import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';

const Onboarding = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-32 pb-16">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-foreground mb-4">Welcome to ThirstyGrass!</h1>
            <p className="text-muted-foreground mb-8">
              Let's set up your lawn profile so we can give you personalized watering recommendations.
            </p>
            <p className="text-muted-foreground">Onboarding form coming soon.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Onboarding;
