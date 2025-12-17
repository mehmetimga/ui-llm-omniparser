import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  Ban,
  Mail,
} from 'lucide-react';

const players = [
  {
    id: '1',
    name: 'PokerKing99',
    email: 'king99@email.com',
    balance: '$12,500',
    status: 'active',
    gamesPlayed: 156,
    joined: '2024-01-15',
  },
  {
    id: '2',
    name: 'RoyalFlush',
    email: 'royal@email.com',
    balance: '$8,200',
    status: 'active',
    gamesPlayed: 89,
    joined: '2024-02-20',
  },
  {
    id: '3',
    name: 'AllInAlways',
    email: 'allin@email.com',
    balance: '$5,600',
    status: 'suspended',
    gamesPlayed: 234,
    joined: '2023-11-05',
  },
  {
    id: '4',
    name: 'CardShark',
    email: 'shark@email.com',
    balance: '$15,800',
    status: 'active',
    gamesPlayed: 312,
    joined: '2023-08-12',
  },
  {
    id: '5',
    name: 'BigBlind',
    email: 'bigblind@email.com',
    balance: '$3,200',
    status: 'active',
    gamesPlayed: 67,
    joined: '2024-03-01',
  },
  {
    id: '6',
    name: 'NightOwl',
    email: 'owl@email.com',
    balance: '$7,900',
    status: 'inactive',
    gamesPlayed: 145,
    joined: '2023-12-10',
  },
  {
    id: '7',
    name: 'HighRoller',
    email: 'highroller@email.com',
    balance: '$45,000',
    status: 'active',
    gamesPlayed: 456,
    joined: '2023-06-25',
  },
  {
    id: '8',
    name: 'AceHunter',
    email: 'ace@email.com',
    balance: '$2,100',
    status: 'active',
    gamesPlayed: 34,
    joined: '2024-03-10',
  },
];

export default function PlayersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || player.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleAllPlayers = () => {
    if (selectedPlayers.length === filteredPlayers.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(filteredPlayers.map((p) => p.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Players</h1>
          <p className="text-gray-500">Manage player accounts and balances</p>
        </div>
        <button className="btn-primary">Add Player</button>
      </div>

      {/* Filters */}
      <div className="bg-poker-card border border-poker-border rounded-xl p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field pl-10 pr-8 appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedPlayers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {selectedPlayers.length} selected
              </span>
              <button className="btn-secondary text-sm py-1.5">
                <Mail className="w-4 h-4 mr-1 inline" />
                Email
              </button>
              <button className="btn-danger text-sm py-1.5">
                <Ban className="w-4 h-4 mr-1 inline" />
                Suspend
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-poker-card border border-poker-border rounded-xl overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">
                <input
                  type="checkbox"
                  checked={selectedPlayers.length === filteredPlayers.length}
                  onChange={toggleAllPlayers}
                  className="w-4 h-4 rounded border-poker-border bg-poker-darker text-cyan-500 focus:ring-cyan-500"
                />
              </th>
              <th>Player</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Games Played</th>
              <th>Joined</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => (
              <tr key={player.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedPlayers.includes(player.id)}
                    onChange={() => togglePlayerSelection(player.id)}
                    className="w-4 h-4 rounded border-poker-border bg-poker-darker text-cyan-500 focus:ring-cyan-500"
                  />
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-purple-600/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                      <span className="text-cyan-400 font-bold">
                        {player.name[0]}
                      </span>
                    </div>
                    <div>
                      <Link
                        to={`/players/${player.id}`}
                        className="font-medium text-white hover:text-cyan-400"
                      >
                        {player.name}
                      </Link>
                      <p className="text-sm text-gray-500">{player.email}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`badge ${
                      player.status === 'active'
                        ? 'badge-success'
                        : player.status === 'inactive'
                          ? 'badge-warning'
                          : 'badge-danger'
                    }`}
                  >
                    {player.status}
                  </span>
                </td>
                <td className="font-display font-bold text-green-400">
                  {player.balance}
                </td>
                <td className="text-gray-300">{player.gamesPlayed}</td>
                <td className="text-gray-400">{player.joined}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/players/${player.id}`}
                      className="p-2 rounded-lg hover:bg-poker-darker text-gray-400 hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button className="p-2 rounded-lg hover:bg-poker-darker text-gray-400 hover:text-white transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-poker-border">
          <p className="text-sm text-gray-400">
            Showing <span className="font-medium text-white">1</span> to{' '}
            <span className="font-medium text-white">{filteredPlayers.length}</span> of{' '}
            <span className="font-medium text-white">{players.length}</span> players
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary py-1.5 px-3" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="btn-secondary py-1.5 px-3 bg-cyan-500/20 text-cyan-400">
              1
            </button>
            <button className="btn-secondary py-1.5 px-3">2</button>
            <button className="btn-secondary py-1.5 px-3">3</button>
            <button className="btn-secondary py-1.5 px-3">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

