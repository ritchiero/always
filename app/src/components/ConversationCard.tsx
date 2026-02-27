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
            case 'positive': return 'text-green-500';
            case 'negative': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <Link href={`/conversations/${id}`}>
            <div className="group relative bg-zinc-900/50 hover:bg-zinc-900/70 border border-zinc-800 rounded-xl p-6 cursor-pointer transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                                {analysis.title || 'Conversación sin título'}
                            </h3>
                        </div>
                    </div>
                </div>

                {analysis.summary && (
                    <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                        {analysis.summary}
                    </p>
                )}

                <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-400">
                            {formatTime(startTime)} • {formatDuration(totalDuration)}
                        </span>
                    </div>

                    {analysis.participants && analysis.participants.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-400">
                                {analysis.participants.join(', ')}
                            </span>
                        </div>
                    )}

                    {analysis.topics && analysis.topics.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                            <Tag className="w-4 h-4 text-gray-500" />
                            <div className="flex flex-wrap gap-1">
                                {analysis.topics.map((topic, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-0.5 bg-zinc-800 text-gray-300 rounded-full text-xs"
                                    >
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.sentiment && (
                        <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className={`w-4 h-4 ${getSentimentColor(analysis.sentiment)}`} />
                            <span className={getSentimentColor(analysis.sentiment)}>
                                {analysis.sentiment === 'positive' ? 'Positivo' :
                                 analysis.sentiment === 'negative' ? 'Negativo' : 'Neutral'}
                            </span>
                        </div>
                    )}

                    {analysis.actionItems && analysis.actionItems.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                            <CheckSquare className="w-4 h-4 text-orange-400" />
                            <span className="text-gray-400">
                                {analysis.actionItems.length} acción{analysis.actionItems.length !== 1 ? 'es' : ''}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                    <span className="text-xs text-gray-500">
                        {chunkIds.length} chunk{chunkIds.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-blue-400 group-hover:text-blue-300">
                        Ver detalles →
                    </span>
                </div>
            </div>
        </Link>
    );
}
