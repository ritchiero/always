'use client';

import { useState } from 'react';

// Icons as simple SVG components
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const TimelineIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TasksIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const InsightsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

export default function Home() {
  const [activeNav, setActiveNav] = useState('home');
  const [activeTab, setActiveTab] = useState('transcription');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [chatMessage, setChatMessage] = useState('');

  const navItems = [
    { id: 'home', icon: HomeIcon, label: 'Home' },
    { id: 'timeline', icon: TimelineIcon, label: 'Timeline' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
    { id: 'tasks', icon: TasksIcon, label: 'Tasks' },
    { id: 'search', icon: SearchIcon, label: 'Search' },
    { id: 'insights', icon: InsightsIcon, label: 'Insights' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const tabs = [
    { id: 'transcription', label: 'Transcription' },
    { id: 'screens', label: 'Screens' },
    { id: 'summary', label: 'Summary' },
    { id: 'tasks', label: 'Tasks' },
  ];

  const timelineEvents = [
    { time: '09:00', title: 'Morning standup', type: 'meeting', duration: '30m' },
    { time: '10:30', title: 'Deep work session', type: 'focus', duration: '2h' },
    { time: '12:30', title: 'Lunch break', type: 'break', duration: '1h' },
    { time: '14:00', title: 'Client call', type: 'meeting', duration: '45m' },
    { time: '15:00', title: 'Code review', type: 'work', duration: '1h' },
    { time: '16:30', title: 'Team sync', type: 'meeting', duration: '30m' },
  ];

  const upcomingEvents = [
    { time: '17:00', title: 'Design review', color: 'bg-blue-500' },
    { time: '18:30', title: 'Gym session', color: 'bg-green-500' },
  ];

  const transcriptionData = [
    { time: '14:32', speaker: 'You', text: 'So the main focus for this sprint will be improving the user onboarding flow.' },
    { time: '14:33', speaker: 'Sarah', text: 'I agree. The current drop-off rate at step 3 is concerning. We should simplify the form fields.' },
    { time: '14:34', speaker: 'You', text: 'Good point. Let\'s also add progress indicators to help users understand where they are in the process.' },
    { time: '14:35', speaker: 'Mike', text: 'I can start working on the analytics dashboard to track these improvements.' },
    { time: '14:36', speaker: 'You', text: 'Perfect. Let\'s also consider adding tooltips for the more complex fields.' },
  ];

  const extractedData = [
    { label: 'Sprint Focus', value: 'User onboarding improvement' },
    { label: 'Key Metric', value: 'Drop-off rate at step 3' },
    { label: 'Assigned', value: 'Mike - Analytics dashboard' },
  ];

  const insights = [
    { type: 'positive', text: 'Team alignment is strong on priorities' },
    { type: 'warning', text: 'Consider adding more specific deadlines' },
    { type: 'positive', text: 'Good delegation of tasks' },
  ];

  const tasksList = [
    { text: 'Simplify form fields in step 3', done: false },
    { text: 'Add progress indicators', done: false },
    { text: 'Create analytics dashboard', done: false },
    { text: 'Add tooltips for complex fields', done: false },
  ];

  return (
    <main className="flex h-screen bg-black text-white font-['Inter',sans-serif]">
      {/* Left Sidebar - Icon Navigation */}
      <div className="w-16 bg-black border-r border-white/10 flex flex-col items-center py-4">
        {/* Recording Indicator */}
        <div className="mb-6">
          <button
            onClick={() => setIsRecording(!isRecording)}
            className="relative w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
            {isRecording && (
              <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping" />
            )}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  activeNav === item.id
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon />
              </button>
            );
          })}
        </nav>
      </div>

      {/* Secondary Sidebar - Timeline */}
      <div className="w-64 bg-black border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-gray-400">Today&apos;s Timeline</h2>
          <p className="text-xs text-gray-600 mt-1">Monday, January 26</p>
        </div>

        {/* Timeline Events */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {timelineEvents.map((event, idx) => (
              <div key={idx} className="flex gap-3 group">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500">{event.time}</span>
                  <div className="w-px h-full bg-white/10 mt-1" />
                </div>
                <div className="flex-1 pb-3">
                  <div className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-gray-500">{event.duration}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="p-4 border-t border-white/10">
          <h3 className="text-xs font-medium text-gray-400 mb-3">UPCOMING</h3>
          <div className="space-y-2">
            {upcomingEvents.map((event, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${event.color}`} />
                <span className="text-xs text-gray-500">{event.time}</span>
                <span className="text-sm">{event.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Tabs */}
        <div className="h-14 border-b border-white/10 flex items-center px-4 gap-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {isRecording && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-gray-400">Recording</span>
              <span className="text-gray-600">• 00:47:32</span>
            </div>
          )}
        </div>

        {/* Transcription Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'transcription' && (
            <div className="max-w-3xl space-y-4">
              {transcriptionData.map((item, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-600 mt-1 w-12">{item.time}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-blue-500">{item.speaker}</span>
                      <p className="text-gray-300 mt-1">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isRecording && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm">Listening...</span>
                </div>
              )}
            </div>
          )}
          {activeTab === 'screens' && (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-video bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                  <span className="text-gray-600">Screenshot {i}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'summary' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium mb-4">Meeting Summary</h3>
              <p className="text-gray-400">The team discussed improving the user onboarding flow, focusing on reducing drop-off rates and enhancing user experience with progress indicators and tooltips.</p>
            </div>
          )}
          {activeTab === 'tasks' && (
            <div className="max-w-2xl space-y-2">
              {tasksList.map((task, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-600" />
                  <span>{task.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-80 bg-black border-l border-white/10 flex flex-col">
        {/* Summary Section */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">SUMMARY</h3>
          <p className="text-sm text-gray-300">Sprint planning meeting focused on improving user onboarding experience and reducing drop-off rates.</p>
        </div>

        {/* Extracted Data */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">EXTRACTED DATA</h3>
          <div className="space-y-2">
            {extractedData.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-500">{item.label}</span>
                <span className="text-gray-300">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">INSIGHTS</h3>
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                  insight.type === 'positive' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="text-sm text-gray-300">{insight.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-400 mb-3">ACTION ITEMS</h3>
          <div className="space-y-2">
            {tasksList.map((task, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center">
                  {task.done && <div className="w-2 h-2 rounded-sm bg-blue-500" />}
                </div>
                <span className="text-gray-300">{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all z-50 ${
          isChatOpen ? 'bg-white/10' : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isChatOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-black border border-white/10 rounded-2xl shadow-2xl flex flex-col z-40">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-medium">AI Assistant</h3>
            <p className="text-xs text-gray-500">Ask questions about your recordings</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-blue-500">AI</span>
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 max-w-[80%]">
                  <p className="text-sm text-gray-300">Hello! I can help you understand your recordings, find specific information, or summarize conversations. What would you like to know?</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50"
              />
              <button className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition-colors">
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
