import {
  Users,
  Trophy,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';

const stats = [
  {
    label: 'Total Players',
    value: '12,847',
    change: '+12.5%',
    trend: 'up',
    icon: Users,
    color: 'cyan',
  },
  {
    label: 'Active Tournaments',
    value: '24',
    change: '+3',
    trend: 'up',
    icon: Trophy,
    color: 'gold',
  },
  {
    label: 'Total Revenue',
    value: '$284,500',
    change: '+8.2%',
    trend: 'up',
    icon: DollarSign,
    color: 'green',
  },
  {
    label: 'Active Tables',
    value: '156',
    change: '-2.1%',
    trend: 'down',
    icon: TrendingUp,
    color: 'purple',
  },
];

const recentActivity = [
  {
    id: 1,
    type: 'player_join',
    message: 'New player "PokerKing99" registered',
    time: '2 min ago',
  },
  {
    id: 2,
    type: 'tournament',
    message: 'Tournament "Sunday Million" started',
    time: '15 min ago',
  },
  {
    id: 3,
    type: 'withdrawal',
    message: 'Withdrawal request from "HighRoller" - $5,000',
    time: '32 min ago',
  },
  {
    id: 4,
    type: 'player_join',
    message: 'New player "AceHunter" registered',
    time: '1 hour ago',
  },
  {
    id: 5,
    type: 'tournament',
    message: 'Tournament "Daily Freeroll" completed',
    time: '2 hours ago',
  },
];

const topPlayers = [
  { rank: 1, name: 'PokerChamp', balance: '$125,400', games: 342 },
  { rank: 2, name: 'RoyalFlush', balance: '$98,200', games: 287 },
  { rank: 3, name: 'AllInAlways', balance: '$76,500', games: 256 },
  { rank: 4, name: 'CardShark', balance: '$65,800', games: 198 },
  { rank: 5, name: 'BigBlind', balance: '$54,300', games: 176 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            cyan: 'from-cyan-500/20 to-cyan-600/20 text-cyan-400 border-cyan-500/30',
            gold: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400 border-yellow-500/30',
            green: 'from-green-500/20 to-green-600/20 text-green-400 border-green-500/30',
            purple: 'from-purple-500/20 to-purple-600/20 text-purple-400 border-purple-500/30',
          };
          return (
            <div
              key={stat.label}
              className="bg-poker-card border border-poker-border rounded-xl p-6 card-hover"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[stat.color as keyof typeof colorClasses]} border flex items-center justify-center`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm ${
                    stat.trend === 'up' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {stat.change}
                </div>
              </div>
              <h3 className="text-3xl font-display font-bold text-white mb-1">
                {stat.value}
              </h3>
              <p className="text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-poker-card border border-poker-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Recent Activity
            </h2>
            <button className="text-sm text-cyan-400 hover:text-cyan-300">
              View all
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-poker-darker transition-colors"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    activity.type === 'player_join'
                      ? 'bg-green-400'
                      : activity.type === 'tournament'
                        ? 'bg-yellow-400'
                        : 'bg-cyan-400'
                  }`}
                />
                <p className="flex-1 text-gray-300">{activity.message}</p>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Players */}
        <div className="bg-poker-card border border-poker-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Top Players
            </h2>
            <button className="text-sm text-cyan-400 hover:text-cyan-300">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {topPlayers.map((player) => (
              <div
                key={player.rank}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-poker-darker transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    player.rank === 1
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : player.rank === 2
                        ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        : player.rank === 3
                          ? 'bg-amber-600/20 text-amber-500 border border-amber-600/30'
                          : 'bg-poker-darker text-gray-500'
                  }`}
                >
                  {player.rank}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{player.name}</p>
                  <p className="text-sm text-gray-500">{player.games} games</p>
                </div>
                <span className="font-display font-bold text-green-400">
                  {player.balance}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

