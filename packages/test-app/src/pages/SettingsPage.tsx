import { useState } from 'react';
import {
  Settings,
  User,
  Shield,
  Bell,
  Palette,
  Database,
  Save,
} from 'lucide-react';

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'database', label: 'Database', icon: Database },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    siteName: 'Poker Admin',
    timezone: 'UTC',
    currency: 'USD',
    maintenanceMode: false,
    email: 'admin@poker.com',
    name: 'Admin User',
    twoFactor: true,
    emailNotifications: true,
    pushNotifications: false,
    theme: 'dark',
    language: 'en',
  });

  const handleSave = () => {
    // Save settings logic
    alert('Settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Settings</h1>
        <p className="text-gray-500">Manage your application preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tabs Sidebar */}
        <div className="w-64 bg-poker-card border border-poker-border rounded-xl p-4">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-cyan-500/20 to-purple-600/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:bg-poker-darker hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-poker-card border border-poker-border rounded-xl p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-display font-bold text-white">
                General Settings
              </h2>

              <div className="grid gap-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={(e) =>
                      setSettings({ ...settings, siteName: e.target.value })
                    }
                    className="input-field max-w-md"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Timezone
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={(e) =>
                      setSettings({ ...settings, timezone: e.target.value })
                    }
                    className="input-field max-w-md"
                  >
                    <option value="UTC">UTC</option>
                    <option value="EST">Eastern Time</option>
                    <option value="PST">Pacific Time</option>
                    <option value="CET">Central European Time</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Default Currency
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) =>
                      setSettings({ ...settings, currency: e.target.value })
                    }
                    className="input-field max-w-md"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <p className="font-medium text-white">Maintenance Mode</p>
                    <p className="text-sm text-gray-500">
                      Disable access for regular users
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        maintenanceMode: !settings.maintenanceMode,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.maintenanceMode
                        ? 'bg-cyan-500'
                        : 'bg-poker-border'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-all ${
                        settings.maintenanceMode
                          ? 'translate-x-6'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-display font-bold text-white">
                Profile Settings
              </h2>

              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-display font-bold text-3xl">
                  A
                </div>
                <div>
                  <button className="btn-secondary text-sm">Change Avatar</button>
                  <p className="text-xs text-gray-500 mt-2">
                    JPG, PNG or GIF. Max 2MB.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 max-w-md">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) =>
                      setSettings({ ...settings, name: e.target.value })
                    }
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) =>
                      setSettings({ ...settings, email: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-display font-bold text-white">
                Security Settings
              </h2>

              <div className="space-y-6 max-w-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      Two-Factor Authentication
                    </p>
                    <p className="text-sm text-gray-500">
                      Add an extra layer of security
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        twoFactor: !settings.twoFactor,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.twoFactor ? 'bg-green-500' : 'bg-poker-border'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-all ${
                        settings.twoFactor
                          ? 'translate-x-6'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-4 border-t border-poker-border">
                  <p className="font-medium text-white mb-2">Change Password</p>
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Current password"
                      className="input-field"
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      className="input-field"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      className="input-field"
                    />
                    <button className="btn-primary">Update Password</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-display font-bold text-white">
                Notification Settings
              </h2>

              <div className="space-y-4 max-w-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Email Notifications</p>
                    <p className="text-sm text-gray-500">
                      Receive updates via email
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        emailNotifications: !settings.emailNotifications,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.emailNotifications
                        ? 'bg-cyan-500'
                        : 'bg-poker-border'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-all ${
                        settings.emailNotifications
                          ? 'translate-x-6'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Push Notifications</p>
                    <p className="text-sm text-gray-500">
                      Receive browser notifications
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        pushNotifications: !settings.pushNotifications,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.pushNotifications
                        ? 'bg-cyan-500'
                        : 'bg-poker-border'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-all ${
                        settings.pushNotifications
                          ? 'translate-x-6'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-display font-bold text-white">
                Appearance Settings
              </h2>

              <div className="space-y-6 max-w-md">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Theme</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSettings({ ...settings, theme: 'dark' })}
                      className={`flex-1 p-4 rounded-lg border transition-all ${
                        settings.theme === 'dark'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-poker-border hover:border-gray-600'
                      }`}
                    >
                      <div className="w-full h-8 bg-poker-dark rounded mb-2"></div>
                      <p className="text-sm text-white">Dark</p>
                    </button>
                    <button
                      onClick={() => setSettings({ ...settings, theme: 'light' })}
                      className={`flex-1 p-4 rounded-lg border transition-all ${
                        settings.theme === 'light'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-poker-border hover:border-gray-600'
                      }`}
                    >
                      <div className="w-full h-8 bg-gray-200 rounded mb-2"></div>
                      <p className="text-sm text-white">Light</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) =>
                      setSettings({ ...settings, language: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-6">
              <h2 className="text-lg font-display font-bold text-white">
                Database Settings
              </h2>

              <div className="bg-poker-darker rounded-lg p-4 max-w-md">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="text-green-400 font-medium">Connected</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="text-white">PostgreSQL</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Size</p>
                    <p className="text-white">2.4 GB</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Connections</p>
                    <p className="text-white">24 / 100</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="btn-secondary">Backup Database</button>
                <button className="btn-secondary">View Logs</button>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-poker-border">
            <button onClick={handleSave} className="btn-primary">
              <Save className="w-4 h-4 mr-2 inline" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

