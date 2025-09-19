import React, { useEffect, useState } from "react";
import AppLayout from "@/layouts/app-layout";
import { Head, usePage } from "@inertiajs/react";
import Pusher from "pusher-js";

interface Message {
  id: string;
  content: string;
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
  timestamp: string;
}
type Props = { 
    roomId: {code: string; rules: string[] };
};

const TestEvent = ({ roomId }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { props } = usePage();

  useEffect(() => {
    // Initialize Pusher
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    });

    // Subscribe to channel
    const channel = pusher.subscribe(`room-${roomId}`);

    // Listen for event
    channel.bind("my-event", (data: any) => {
      const newMessage: Message = {
        id: Date.now().toString() + Math.random().toString(),
        content: data.message,
        user: data.user,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/board/${roomId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({ message: newMessage }),
      });

      if (response.ok) {
        setNewMessage('');
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <AppLayout>
      <Head title="Test Event - Live Chat" />
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Live Chat Test</h1>
        
        {/* Messages Display */}
        <div className="bg-white border rounded-lg p-4 h-96 overflow-y-auto mb-4">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No messages yet. Be the first to send one!</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">
                      {msg.user ? msg.user.name : 'System'}
                    </span>
                    <span className="text-xs">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="bg-black rounded-lg p-2 mt-1">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Input Form */}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
        
        <p className="text-sm text-gray-600 mt-2">
          Messages are broadcast live to all users on this page!
        </p>
      </div>
    </AppLayout>
  );
};

export default TestEvent;
