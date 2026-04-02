
import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-grass-50 opacity-70"></div>
      
      {/* Animated circles */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-sky-200 opacity-20 blur-3xl animate-float" style={{ animationDelay: '0s' }}></div>
      <div className="absolute top-3/4 left-2/3 w-96 h-96 rounded-full bg-grass-200 opacity-20 blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 right-1/4 w-72 h-72 rounded-full bg-blue-200 opacity-15 blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiNmOGZhZmMiIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNNjAgMEgwdjYwaDYwVjB6TTIgMmg1NnY1NkgyVjJ6IiBmaWxsPSIjZTJlOGYwIiBmaWxsLW9wYWNpdHk9Ii4wNSIvPjwvZz48L3N2Zz4=')] opacity-30"></div>
    </div>
  );
};

export default AnimatedBackground;
