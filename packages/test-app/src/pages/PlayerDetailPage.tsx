import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Ban,
  DollarSign,
  Trophy,
  Clock,
  Edit2,
  X,
  Save,
} from 'lucide-react';

// Mock player data
const playerData = {
  id: '1',
  name: 'PokerKing99',
  email: 'king99@email.com',
  balance: 12500,
  status: 'active',
  gamesPlayed: 156,
  gamesWon: 67,
  joined: '2024-01-15',
  lastActive: '2024-03-15 14:32',
  totalDeposits: 25000,
  totalWithdrawals: 12500,
  avatar: null,
  phone: '+1 555-123-4567',
  country: 'United States',
};

const recentGames = [
  { id: 1, type: 'Texas Holdem', result: 'Won', amount: '+$450', date: '2024-03-15' },
  { id: 2, type: 'Omaha', result: 'Lost', amount: '-$200', date: '2024-03-14' },
  { id: 3, type: 'Texas Holdem', result: 'Won', amount: '+$800', date: '2024-03-14' },
  { id: 4, type: 'Tournament', result: '3rd Place', amount: '+$1,500', date: '2024-03-12' },
  { id: 5, type: 'Texas Holdem', result: 'Lost', amount: '-$150', date: '2024-03-11' },
];

export default function PlayerDetailPage() {
  const { id: _id } = useParams(); // id used for data fetching in real implementation
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: playerData.name,
    email: playerData.email,
    phone: playerData.phone,
    country: playerData.country,
  });

  const handleSave = () => {
    // Save logic here
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/players"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Players
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-display font-bold text-3xl shadow-neon">
            {playerData.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              {playerData.name}
            </h1>
            <p className="text-gray-400">{playerData.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`badge ${playerData.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                {playerData.status}
              </span>
              <span className="text-sm text-gray-500">
                Member since {playerData.joined}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary">
            <Mail className="w-4 h-4 mr-2 inline" />
            Email
          </button>
          <button className="btn-danger">
            <Ban className="w-4 h-4 mr-2 inline" />
            Suspend
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-poker-card border border-poker-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-gray-400">Balance</span>
          </div>
          <p className="text-2xl font-display font-bold text-green-400">
            ${playerData.balance.toLocaleString()}
          </p>
        </div>
        <div className="bg-poker-card border border-poker-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400">Games Won</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">
            {playerData.gamesWon}
            <span className="text-sm text-gray-500 font-normal ml-2">
              / {playerData.gamesPlayed}
            </span>
          </p>
        </div>
        <div className="bg-poker-card border border-poker-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-cyan-400" />
            <span className="text-gray-400">Total Deposits</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">
            ${playerData.totalDeposits.toLocaleString()}
          </p>
        </div>
        <div className="bg-poker-card border border-poker-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <span className="text-gray-400">Last Active</span>
          </div>
          <p className="text-lg font-display font-bold text-white">
            {playerData.lastActive}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player Info */}
        <div className="bg-poker-card border border-poker-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-display font-bold text-white">
              Player Information
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 rounded-lg hover:bg-poker-darker text-gray-400 hover:text-white transition-colors"
            >
              {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </button>
          </div>

          {isEditing ? (
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Country</label>
                <input
                  type="text"
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  className="input-field"
                />
              </div>
              <button type="button" onClick={handleSave} className="btn-primary w-full">
                <Save className="w-4 h-4 mr-2 inline" />
                Save Changes
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">Username</span>
                <p className="text-white">{playerData.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Email</span>
                <p className="text-white">{playerData.email}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Phone</span>
                <p className="text-white">{playerData.phone}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Country</span>
                <p className="text-white">{playerData.country}</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Games */}
        <div className="lg:col-span-2 bg-poker-card border border-poker-border rounded-xl p-6">
          <h2 className="text-lg font-display font-bold text-white mb-6">
            Recent Games
          </h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Game Type</th>
                <th>Result</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((game) => (
                <tr key={game.id}>
                  <td className="text-white">{game.type}</td>
                  <td>
                    <span
                      className={`badge ${
                        game.result === 'Won' || game.result.includes('Place')
                          ? 'badge-success'
                          : 'badge-danger'
                      }`}
                    >
                      {game.result}
                    </span>
                  </td>
                  <td
                    className={`font-display font-bold ${
                      game.amount.startsWith('+') ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {game.amount}
                  </td>
                  <td className="text-gray-400">{game.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

