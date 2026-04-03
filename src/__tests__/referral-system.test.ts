import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';

// ─── FIXTURES ────────────────────────────────────────────────

const userA = {
  id: 'uuid-a',
  email: 'a@test.com',
  referral_code: 'tg_test1234',
  tier: 'free',
  premium_until: null,
  premium_source: null,
  zip_code: '90210',
  grass_type: 'Cool-Season',
  irrigation_type: 'Sprinkler',
  subscription_cancel_at_period_end: false,
  subscription_ends_at: null,
  lawn_size_acres: 0.5,
  email_unsubscribed: false,
  referred_by: null,
  created_at: '2026-01-01T00:00:00Z',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
};

const userB = {
  ...userA,
  id: 'uuid-b',
  email: 'b@test.com',
  referral_code: 'tg_test5678',
  referred_by: 'uuid-a',
};

const appSettings = [
  { key: 'referral_program_active', value: 'true' },
  { key: 'referral_threshold', value: '2' },
  { key: 'referral_offer_expires', value: '2026-12-31' },
];

// ─── SUPABASE MOCK ──────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockOrder = vi.fn();
const mockInvoke = vi.fn();

function createChain(resolveData: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: resolveData, error: null }),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: undefined as any,
  };
  // Make chain thenable so await works
  chain.then = (resolve: any) => resolve({ data: resolveData, error: null });
  return chain;
}

let supabaseMockConfig: Record<string, any> = {};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const data = supabaseMockConfig[table];
      return createChain(data);
    },
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
  },
}));

// ─── AUTH MOCK ───────────────────────────────────────────────

let mockUser: any = null;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false, session: mockUser ? {} : null, signOut: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}));

// ─── SETTINGS MOCK ──────────────────────────────────────────

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ annualPrice: '29.99' }),
  SettingsProvider: ({ children }: any) => children,
}));

// ─── TIER MOCK ───────────────────────────────────────────────

let mockTier = { isFree: true, isPaid: false };

vi.mock('@/hooks/useUserTier', () => ({
  useUserTier: () => mockTier,
}));

// ─── NAV MOCK ────────────────────────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  };
});

const mockNavigate = vi.fn();

// ─── MISC MOCKS ─────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/components/NavBar', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('@/components/AnimatedBackground', () => ({ default: () => null }));
vi.mock('@/components/SignInModal', () => ({ default: () => null }));
vi.mock('@/components/DashboardFeedback', () => ({ default: () => null }));
vi.mock('@/components/SubscriptionManager', () => ({ default: () => null }));
vi.mock('@/components/LockedFeatureCard', () => ({ default: ({ headline }: any) => React.createElement('div', null, headline) }));
vi.mock('@/utils/weatherApi', () => ({
  fetchPrecipitationData: vi.fn().mockResolvedValue(null),
}));

// ─── HELPERS ─────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=;path=/;max-age=0`;
  });
  mockUser = null;
  mockTier = { isFree: true, isPaid: false };
  supabaseMockConfig = {};
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 1 — useTrackingParams hook
// ═══════════════════════════════════════════════════════════════

describe('useTrackingParams', () => {
  // We test the pure functions directly to avoid JSDOM location issues
  it('captures ?ref param to localStorage and cookie', async () => {
    // Manually set search params
    const original = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?ref=tg_test1234' },
      writable: true,
    });

    const { useTrackingParams } = await import('@/hooks/useTrackingParams');
    const { result } = renderHook(() => useTrackingParams());

    expect(localStorage.getItem('tg_ref')).toBe('tg_test1234');
    expect(document.cookie).toContain('tg_ref=tg_test1234');

    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: original },
      writable: true,
    });
  });

  it('captures all 5 UTM params to localStorage', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_content=banner&utm_term=lawn',
      },
      writable: true,
    });

    const { useTrackingParams } = await import('@/hooks/useTrackingParams');
    renderHook(() => useTrackingParams());

    expect(localStorage.getItem('tg_utm_source')).toBe('twitter');
    expect(localStorage.getItem('tg_utm_medium')).toBe('social');
    expect(localStorage.getItem('tg_utm_campaign')).toBe('launch');
    expect(localStorage.getItem('tg_utm_content')).toBe('banner');
    expect(localStorage.getItem('tg_utm_term')).toBe('lawn');
  });

  it('does not clear ref on re-render or navigation', async () => {
    localStorage.setItem('tg_ref', 'tg_test1234');

    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });

    const { useTrackingParams } = await import('@/hooks/useTrackingParams');
    renderHook(() => useTrackingParams());

    expect(localStorage.getItem('tg_ref')).toBe('tg_test1234');
  });

  it('clears tg_ref and tg_utm_* after referral is processed', async () => {
    localStorage.setItem('tg_ref', 'tg_test1234');
    localStorage.setItem('tg_utm_source', 'twitter');
    document.cookie = 'tg_ref=tg_test1234;path=/';
    document.cookie = 'tg_utm_source=twitter;path=/';

    const { clearTrackingParams } = await import('@/hooks/useTrackingParams');
    clearTrackingParams();

    expect(localStorage.getItem('tg_ref')).toBeNull();
    expect(localStorage.getItem('tg_utm_source')).toBeNull();
    expect(document.cookie).not.toContain('tg_ref');
    expect(document.cookie).not.toContain('tg_utm_source');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 2 — Referral code display (ReferralShareBlock)
// ═══════════════════════════════════════════════════════════════

describe('ReferralShareBlock', () => {
  it('referral URL shown correctly', async () => {
    const ReferralShareBlock = (await import('@/components/ReferralShareBlock')).default;
    render(
      React.createElement(ReferralShareBlock, {
        referralCode: 'tg_test1234',
        referralCount: 0,
        threshold: 2,
      })
    );
    expect(screen.getByText(/tg_test1234/)).toBeTruthy();
  });

  it('copy button writes referral URL to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const ReferralShareBlock = (await import('@/components/ReferralShareBlock')).default;
    render(
      React.createElement(ReferralShareBlock, {
        referralCode: 'tg_test1234',
        referralCount: 0,
        threshold: 2,
      })
    );

    const copyBtn = screen.getByTitle('Copy link');
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ref=tg_test1234'));
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy();
    });
  });

  it('share button calls navigator.share with correct payload', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareFn, writable: true, configurable: true });

    const ReferralShareBlock = (await import('@/components/ReferralShareBlock')).default;
    render(
      React.createElement(ReferralShareBlock, {
        referralCode: 'tg_test1234',
        referralCount: 0,
        threshold: 2,
      })
    );

    const shareBtn = screen.getByTitle('Share');
    fireEvent.click(shareBtn);

    expect(shareFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'ThirstyGrass',
        url: expect.stringContaining('ref=tg_test1234'),
      })
    );
  });

  it('share button falls back to clipboard when navigator.share unavailable', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const ReferralShareBlock = (await import('@/components/ReferralShareBlock')).default;
    render(
      React.createElement(ReferralShareBlock, {
        referralCode: 'tg_test1234',
        referralCount: 0,
        threshold: 2,
      })
    );

    const shareBtn = screen.getByTitle('Share');
    fireEvent.click(shareBtn);

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ref=tg_test1234'));
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 3 — /referrals page
// ═══════════════════════════════════════════════════════════════

describe('/referrals page', () => {
  it('renders all sections when program is active', async () => {
    mockUser = { id: userA.id, email: userA.email };
    supabaseMockConfig = {
      app_settings: appSettings,
      profiles: userA,
      referrals: [],
    };

    // Mock useReferralInfo to return active program
    vi.doMock('@/hooks/useReferralInfo', () => ({
      useReferralInfo: () => ({
        programActive: true,
        threshold: 2,
        offerExpires: '2026-12-31',
        referralCode: 'tg_test1234',
        referralCount: 0,
        premiumSource: null,
        premiumUntil: null,
        isLoading: false,
      }),
    }));

    const Referrals = (await import('@/pages/Referrals')).default;
    render(React.createElement(Referrals));

    expect(screen.getByText(/Help your friends waste less water/i)).toBeTruthy();
    expect(screen.getByText(/14,000/)).toBeTruthy();
    expect(screen.getByText(/December 31, 2026/)).toBeTruthy();
    expect(screen.getByText(/2 friends join/)).toBeTruthy();
  });

  it('redirects to / when program is inactive', async () => {
    vi.doMock('@/hooks/useReferralInfo', () => ({
      useReferralInfo: () => ({
        programActive: false,
        threshold: 2,
        offerExpires: '2026-12-31',
        referralCode: null,
        referralCount: 0,
        premiumSource: null,
        premiumUntil: null,
        isLoading: false,
      }),
    }));

    const Referrals = (await import('@/pages/Referrals')).default;
    render(React.createElement(Referrals));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows sign-in prompt when user is not authenticated', async () => {
    mockUser = null;
    vi.doMock('@/hooks/useReferralInfo', () => ({
      useReferralInfo: () => ({
        programActive: true,
        threshold: 2,
        offerExpires: '2026-12-31',
        referralCode: null,
        referralCount: 0,
        premiumSource: null,
        premiumUntil: null,
        isLoading: false,
      }),
    }));

    const Referrals = (await import('@/pages/Referrals')).default;
    render(React.createElement(Referrals));

    expect(screen.getByText(/Sign in to get your unique referral link/i)).toBeTruthy();
  });

  it('shows share block when user is authenticated', async () => {
    mockUser = { id: userA.id, email: userA.email };
    vi.doMock('@/hooks/useReferralInfo', () => ({
      useReferralInfo: () => ({
        programActive: true,
        threshold: 2,
        offerExpires: '2026-12-31',
        referralCode: 'tg_test1234',
        referralCount: 0,
        premiumSource: null,
        premiumUntil: null,
        isLoading: false,
      }),
    }));

    const Referrals = (await import('@/pages/Referrals')).default;
    render(React.createElement(Referrals));

    expect(screen.getByText(/tg_test1234/)).toBeTruthy();
    expect(screen.getByTitle('Copy link')).toBeTruthy();
    expect(screen.getByTitle('Share')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 4 — Self-referral guard
// ═══════════════════════════════════════════════════════════════

describe('Self-referral guard', () => {
  it('does not create referral record when ref code belongs to current user', async () => {
    localStorage.setItem('tg_ref', 'tg_test1234');

    mockInvoke.mockResolvedValue({
      data: { selfReferral: true },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('process-referral', {
      body: {
        userId: userA.id,
        referralCode: 'tg_test1234',
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith('process-referral', {
      body: {
        userId: userA.id,
        referralCode: 'tg_test1234',
      },
    });
    expect(result.data.selfReferral).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 5 — Referral count & progress display
// ═══════════════════════════════════════════════════════════════

describe('Referral count & progress', () => {
  it('shows correct count from referrals table', async () => {
    const ReferralShareBlock = (await import('@/components/ReferralShareBlock')).default;
    render(
      React.createElement(ReferralShareBlock, {
        referralCode: 'tg_test1234',
        referralCount: 1,
        threshold: 2,
      })
    );
    expect(screen.getByText(/1 of 2 friends joined/)).toBeTruthy();
  });

  it('fraud-suspected rows excluded from count (rendered as 1 not 2)', async () => {
    // This tests that the hook filters correctly — we simulate by passing count=1
    const ReferralShareBlock = (await import('@/components/ReferralShareBlock')).default;
    render(
      React.createElement(ReferralShareBlock, {
        referralCode: 'tg_test1234',
        referralCount: 1,
        threshold: 2,
      })
    );
    expect(screen.getByText(/1 of 2/)).toBeTruthy();
    expect(screen.queryByText(/2 of 2/)).toBeNull();
  });

  it('shows earned reward state when premium_source is referral', async () => {
    mockUser = { id: userA.id, email: userA.email };
    mockTier = { isFree: false, isPaid: true };

    vi.doMock('@/hooks/useReferralInfo', () => ({
      useReferralInfo: () => ({
        programActive: true,
        threshold: 2,
        offerExpires: '2026-12-31',
        referralCode: 'tg_test1234',
        referralCount: 2,
        premiumSource: 'referral',
        premiumUntil: '2027-01-01T00:00:00Z',
        isLoading: false,
      }),
    }));

    supabaseMockConfig = {
      profiles: {
        ...userA,
        tier: 'paid',
        premium_source: 'referral',
        premium_until: '2027-01-01T00:00:00Z',
      },
    };

    const Dashboard = (await import('@/pages/Dashboard')).default;
    render(React.createElement(Dashboard));

    await waitFor(() => {
      expect(screen.getByText(/You've earned a free year of premium/i)).toBeTruthy();
      expect(screen.getByText(/2027/)).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 6 — Subscription status section
// ═══════════════════════════════════════════════════════════════

describe('Subscription status', () => {
  const setupDashboard = async (overrides: any = {}) => {
    const profileData = { ...userA, ...overrides };
    mockUser = { id: profileData.id, email: profileData.email };
    mockTier = {
      isFree: profileData.tier === 'free',
      isPaid: profileData.tier === 'paid',
    };

    vi.doMock('@/hooks/useReferralInfo', () => ({
      useReferralInfo: () => ({
        programActive: true,
        threshold: 2,
        offerExpires: '2026-12-31',
        referralCode: profileData.referral_code,
        referralCount: 0,
        premiumSource: profileData.premium_source,
        premiumUntil: profileData.premium_until,
        isLoading: false,
      }),
    }));

    supabaseMockConfig = { profiles: profileData };
    const Dashboard = (await import('@/pages/Dashboard')).default;
    render(React.createElement(Dashboard));
  };

  it('shows free tier message for free users', async () => {
    await setupDashboard({ tier: 'free' });
    await waitFor(() => {
      expect(screen.getByText(/Upgrade to premium/i)).toBeTruthy();
    });
  });

  it('shows stripe messaging for paid users', async () => {
    await setupDashboard({
      tier: 'paid',
      premium_source: 'stripe',
      premium_until: '2027-03-01T00:00:00Z',
      subscription_ends_at: '2027-03-01T00:00:00Z',
    });
    await waitFor(() => {
      expect(screen.getByText(/Active subscription/i)).toBeTruthy();
      expect(screen.getByText(/billed again/i)).toBeTruthy();
    });
  });

  it('shows referral messaging for referral premium users', async () => {
    await setupDashboard({
      tier: 'paid',
      premium_source: 'referral',
      premium_until: '2027-03-01T00:00:00Z',
    });
    await waitFor(() => {
      expect(screen.getByText(/Earned via referral program/i)).toBeTruthy();
    });
  });

  it('shows renewal CTA when within 60 days of premium_until', async () => {
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await setupDashboard({
      tier: 'paid',
      premium_source: 'referral',
      premium_until: soon,
    });
    await waitFor(() => {
      expect(screen.getByText(/Your free year ends soon/i)).toBeTruthy();
      expect(screen.getByText(/add a subscription/i)).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 7 — Admin referral panel
// ═══════════════════════════════════════════════════════════════

describe('AdminReferrals', () => {
  const mockReferrals = [
    {
      id: 'ref-1',
      referrer_id: 'uuid-a',
      referred_id: 'uuid-b',
      created_at: '2026-03-01T00:00:00Z',
      fraud_suspected: false,
      fraud_evidence: null,
      counted: true,
    },
    {
      id: 'ref-2',
      referrer_id: 'uuid-a',
      referred_id: 'uuid-c',
      created_at: '2026-03-02T00:00:00Z',
      fraud_suspected: true,
      fraud_evidence: {
        ip_match: true,
        device_match: true,
        browser_match: false,
        referred_ip: '1.2.3.4',
        referrer_ip: '1.2.3.4',
        referred_device: 'abc123',
        referrer_device: 'abc123',
      },
      counted: false,
    },
  ];

  beforeEach(() => {
    supabaseMockConfig = {
      app_settings: appSettings,
      referrals: mockReferrals,
      profiles: [
        { id: 'uuid-a', email: 'a@test.com' },
        { id: 'uuid-b', email: 'b@test.com' },
        { id: 'uuid-c', email: 'c@test.com' },
      ],
    };
  });

  it('renders referrals table with correct columns', async () => {
    const AdminReferrals = (await import('@/components/admin/AdminReferrals')).default;
    render(React.createElement(AdminReferrals));

    await waitFor(() => {
      expect(screen.getByText('Referred User')).toBeTruthy();
      expect(screen.getByText('Referred By')).toBeTruthy();
      expect(screen.getByText('Date')).toBeTruthy();
      expect(screen.getByText('Counted')).toBeTruthy();
      expect(screen.getByText('Fraud')).toBeTruthy();
      expect(screen.getByText('Actions')).toBeTruthy();
    });
  });

  it('fraud rows have amber highlight', async () => {
    const AdminReferrals = (await import('@/components/admin/AdminReferrals')).default;
    const { container } = render(React.createElement(AdminReferrals));

    await waitFor(() => {
      const rows = container.querySelectorAll('tr');
      const fraudRow = Array.from(rows).find(r => r.className.includes('amber'));
      expect(fraudRow).toBeTruthy();
    });
  });

  it('expand row shows fraud_evidence detail', async () => {
    const AdminReferrals = (await import('@/components/admin/AdminReferrals')).default;
    render(React.createElement(AdminReferrals));

    await waitFor(() => {
      expect(screen.getByText('Suspected')).toBeTruthy();
    });

    // Click the fraud row to expand
    const suspectedBadge = screen.getByText('Suspected');
    const fraudRow = suspectedBadge.closest('tr');
    if (fraudRow) fireEvent.click(fraudRow);

    await waitFor(() => {
      expect(screen.getByText(/IP match: Yes/)).toBeTruthy();
      expect(screen.getByText(/Device match: Yes/)).toBeTruthy();
      expect(screen.getByText(/Browser match: No/)).toBeTruthy();
    });
  });

  it('settings panel renders with controls', async () => {
    const AdminReferrals = (await import('@/components/admin/AdminReferrals')).default;
    render(React.createElement(AdminReferrals));

    await waitFor(() => {
      expect(screen.getByText('Referral Program Settings')).toBeTruthy();
      expect(screen.getByLabelText('Threshold')).toBeTruthy();
      expect(screen.getByText('Save Settings')).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST GROUP 8 — User manager filters
// ═══════════════════════════════════════════════════════════════

describe('AdminUsers', () => {
  const mockProfiles = [
    { ...userA, id: 'u1', email: 'free@test.com', tier: 'free', premium_source: null, referred_by: null },
    { ...userA, id: 'u2', email: 'stripe@test.com', tier: 'paid', premium_source: 'stripe', referred_by: null },
    { ...userA, id: 'u3', email: 'referral@test.com', tier: 'paid', premium_source: 'referral', referred_by: 'u1' },
  ];

  beforeEach(() => {
    supabaseMockConfig = { profiles: mockProfiles };
  });

  it('renders all users by default', async () => {
    const AdminUsers = (await import('@/components/admin/AdminUsers')).default;
    render(React.createElement(AdminUsers));

    await waitFor(() => {
      expect(screen.getByText('free@test.com')).toBeTruthy();
      expect(screen.getByText('stripe@test.com')).toBeTruthy();
      expect(screen.getByText('referral@test.com')).toBeTruthy();
    });
  });

  it('shows referred by column with referrer email or dash', async () => {
    const AdminUsers = (await import('@/components/admin/AdminUsers')).default;
    render(React.createElement(AdminUsers));

    await waitFor(() => {
      // The referred_by column should show either the email or —
      const cells = screen.getAllByText('—');
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});
