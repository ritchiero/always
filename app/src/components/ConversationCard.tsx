'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageSquare, Clock, Users, Tag, CheckSquare, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface ConversationCardProps {
    conversation: {
          id: string;
          startTime: any;
          endTime: any;
          totalDuration: number;
          analysis: {
            title: string;
            summary: string;
            participants: string[];
            topics: string[];
            actionItems: any[];
            sentiment?: string;
            keyDecisions?: string[];
            followUps?: string[];
          };
          chunkIds: string[];
    };
}

export default function ConversationCard({ conversation }: ConversationCardProps) {
    const { id, startTime, totalDuration, analysis, chunkIds } = conversation;

  const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hours}h ${remainingMins}m`;
  };

  const formatTime = (timestamp: any) => {
        try {
                const date = timestamp.toDate();
                return formatDistanceToNow(date, { addSuffix: true, locale: es });
        } catch {
                return 'Fecha desconocida';
        }
  };

  const getSentimentColor = (sentiment?: string) => {
        switch (sentiment) {
          case 'positive':
                    return 'text-green-500';
          case 'negative':
                    return 'text-red-500';
          default:
                    return 'text-gray-500';
        }
  };

  return (
        <Link href={`/conversations/${id}`}>
                <div className="group relative bg-zinc-900/50 hover:bg-zinc-900/70 border border-zinc-800 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
                        <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                              <div className="flex items-center gap-3 mb-2">
                                                            <MessageSquare className="w-5 h-5 text-blue-400" />
                                                            <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                                                              {analysis.title || 'Conversación sin título'}
                                                            </h3>h3>
                                              </div>div>
                                              
                                    {analysis.summary && (
                        <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                          {analysis.summary}
                        </p>p>
                                              )}
                                  </div>div>
                                  
                          {analysis.sentiment && (
                      <div className={`${getSentimentColor(analysis.sentiment)}`}>
                                    <TrendingUp className="w-5 h-5" />
                      </div>div>
                                  )}
                        </div>div>
                
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div className="flex items-center gap-2">
                                              <Clock className="w-4 h-4 text-gray-500" />
                                              <span className="text-sm text-gray-300">
                                                {formatDuration(totalDuration)}
                                              </span>span>
                                  </div>div>
                        
                          {analysis.participants && analysis.participants.length > 0 && (
                      <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-300 truncate">
                                      {analysis.participants.slice(0, 2).join(', ')}
                                      {analysis.participants.length > 2 && ` +${analysis.participants.length - 2}`}
                                    </span>span>
                      </div>div>
                                  )}
                        
                          {analysis.actionItems && analysis.actionItems.length > 0 && (
                      <div className="flex items-center gap-2">
                                    <CheckSquare className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-300">
                                      {analysis.actionItems.length} tareas
                                    </span>span>
                      </div>div>
                                  )}
                        
                                  <div className="flex items-center gap-2">
                                              <Tag className="w-4 h-4 text-gray-500" />
                                              <span className="text-sm text-gray-300">
                                                {chunkIds.length} chunks
                                              </span>span>
                                  </div>div>
                        </div>div>
                
                  {analysis.topics && analysis.topics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {analysis.topics.slice(0, 3).map((topic, idx) => (
                                    <span
                                                      key={idx}
                                                      className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20"
                                                    >
                                      {topic}
                                    </span>span>
                                  ))}
                      {analysis.topics.length > 3 && (
                                    <span className="px-2 py-1 text-xs bg-gray-500/10 text-gray-400 rounded-md">
                                                    +{analysis.topics.length - 3}
                                    </span>span>
                                )}
                    </div>div>
                        )}
                
                        <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>{formatTime(startTime)}</span>span>
                                  <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                              Ver detalles →
                                  </span>span>
                        </div>div>
                </div>div>
        </Link>Link>
      );
}</div>
