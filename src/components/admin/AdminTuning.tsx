import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearTuningCache } from '@/utils/weatherApi';

interface SettingRow {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

const AdminTuning: React.FC = () => {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('id, key, value, description')
        .order('key');
      if (data) setSettings(data as SettingRow[]);
      setLoading(false);
    })();
  }, []);

  const handleChange = (key: string, newValue: string) => {
    setSettings(prev =>
      prev.map(s => (s.key === key ? { ...s, value: newValue } : s))
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    for (const s of settings) {
      await supabase
        .from('admin_settings')
        .update({ value: s.value, updated_at: new Date().toISOString() })
        .eq('key', s.key);
    }
    clearTuningCache();
    setSaving(false);
    setSaved(true);
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Recommendation Engine Tuning</h3>

      {settings.map(s => (
        <div key={s.key} className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {s.description || s.key}
          </label>
          <input
            type="text"
            value={s.value}
            onChange={e => handleChange(s.key, e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground font-mono">{s.key}</p>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>

      {saved && (
        <p className="text-sm text-green-600 font-medium">Settings saved.</p>
      )}
    </div>
  );
};

export default AdminTuning;
