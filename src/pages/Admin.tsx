import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminBilling from '@/components/admin/AdminBilling';
import AdminCache from '@/components/admin/AdminCache';
import AdminPricing from '@/components/admin/AdminPricing';
import AdminTuning from '@/components/admin/AdminTuning';
import AdminReferrals from '@/components/admin/AdminReferrals';

const ADMIN_EMAIL = 'admin@110labs.com';

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading || !user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-2xl font-bold text-foreground mb-6">ThirstyGrass Admin</h1>
          <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="grid w-full grid-cols-7 mb-6">
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="referrals">Referrals</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="cache">Cache</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="tuning">Tuning</TabsTrigger>
            </TabsList>
            <TabsContent value="analytics"><AdminAnalytics /></TabsContent>
            <TabsContent value="users"><AdminUsers /></TabsContent>
            <TabsContent value="referrals"><AdminReferrals /></TabsContent>
            <TabsContent value="billing"><AdminBilling /></TabsContent>
            <TabsContent value="cache"><AdminCache /></TabsContent>
            <TabsContent value="pricing"><AdminPricing /></TabsContent>
            <TabsContent value="tuning">
              <div className="max-w-[600px] mx-auto">
                <AdminTuning />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
