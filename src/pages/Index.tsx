
import React, { useState } from 'react';
import { ArrowDown, DropletIcon, CloudRain } from 'lucide-react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AddressForm from '@/components/AddressForm';
import PrecipitationDisplay, { PrecipitationData } from '@/components/PrecipitationDisplay';
import AnimatedBackground from '@/components/AnimatedBackground';
import { fetchPrecipitationData } from '@/utils/weatherApi';

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [precipitationData, setPrecipitationData] = useState<PrecipitationData | null>(null);

  const handleZipSubmit = async (zipCode: string) => {
    setIsLoading(true);
    try {
      const data = await fetchPrecipitationData(zipCode);
      setPrecipitationData(data);
    } catch (error) {
      console.error('Error fetching precipitation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary mb-6 fade-in-up" style={{ animationDelay: '0.1s' }}>
                <DropletIcon className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Smart Lawn Watering</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6 fade-in-up" style={{ animationDelay: '0.2s' }}>
                Know Exactly When To Water Your Lawn
              </h1>
              
              <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto fade-in-up" style={{ animationDelay: '0.3s' }}>
                Stop guessing and save water. Our tool analyzes real-time precipitation data for your location to give you customized watering recommendations.
              </p>
              
              <div className="fade-in-up" style={{ animationDelay: '0.4s' }}>
                <AddressForm onSubmit={handleAddressSubmit} isLoading={isLoading} />
              </div>
              
              {!precipitationData && (
                <div className="mt-16 flex justify-center fade-in-up" style={{ animationDelay: '0.5s' }}>
                  <div className="animate-bounce">
                    <ArrowDown className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        
        {/* Precipitation Display Section */}
        {precipitationData && (
          <section className="py-12 px-6 max-w-5xl mx-auto">
            <PrecipitationDisplay data={precipitationData} />
          </section>
        )}
        
        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-gray-50">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
              <p className="text-lg text-gray-600">
                Our precise lawn watering system uses real-time weather data to help you maintain a beautiful lawn while conserving water.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center mb-6 neumorphic">
                  <CloudRain className="h-8 w-8 text-sky-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Enter Your Address</h3>
                <p className="text-gray-600">
                  We use your location to access accurate historical precipitation data specific to your area.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-6 neumorphic">
                  <CloudRain className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Analyze Rainfall Data</h3>
                <p className="text-gray-600">
                  Our system analyzes rainfall patterns from the past 1, 3, and 5 days to understand your lawn's moisture level.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-grass-100 flex items-center justify-center mb-6 neumorphic">
                  <DropletIcon className="h-8 w-8 text-grass-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Watering Advice</h3>
                <p className="text-gray-600">
                  Receive personalized recommendations on whether your lawn needs watering based on actual precipitation data.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Benefits Section */}
        <section id="about" className="py-20">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Benefits</h2>
              <p className="text-lg text-gray-600">
                Save water, save money, and maintain a healthier lawn with our precise watering guidance.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <DropletIcon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Water Conservation</h3>
                <p className="text-gray-600">
                  Avoid overwatering by only watering when your lawn truly needs it.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <DropletIcon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Healthier Lawn</h3>
                <p className="text-gray-600">
                  Proper watering leads to stronger roots and more resilient grass.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                  <DropletIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Save Money</h3>
                <p className="text-gray-600">
                  Reduce your water bill by eliminating unnecessary watering cycles.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                  <DropletIcon className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Save Time</h3>
                <p className="text-gray-600">
                  No more guesswork - know exactly when to water with data-driven advice.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section id="contact" className="py-20 bg-gradient-to-b from-white to-sky-50">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/2 bg-gradient-to-br from-primary to-sky-600 p-10 text-white">
                  <h3 className="text-2xl font-bold mb-4">Ready to save water?</h3>
                  <p className="mb-6">
                    Join thousands of homeowners who are keeping their lawns green while conserving water with our smart watering guidance.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-center">
                      <svg className="h-5 w-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Free to use</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="h-5 w-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Real-time precipitation data</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="h-5 w-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Personalized recommendations</span>
                    </li>
                  </ul>
                </div>
                
                <div className="md:w-1/2 p-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Get Started Now</h3>
                  <p className="text-gray-600 mb-6">
                    Enter your address above to get immediate watering recommendations for your lawn.
                  </p>
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all duration-200 transform hover:translate-y-[-2px] hover:shadow-md"
                  >
                    Check Your Address
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
