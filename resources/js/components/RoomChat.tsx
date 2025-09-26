import React, { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { X, MessageCircle, Send } from 'lucide-react';

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

interface RoomChatProps {
  roomId: string | number;
  isOpen: boolean;
  onClose: () => void;
}

const RoomChat: React.FC<RoomChatProps> = ({ roomId, isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Initialize Pusher
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    });

    // Connection status
    pusher.connection.bind('connected', () => {
      setIsConnected(true);
    });
    
    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
    });

    // Subscribe to room-specific channel
    const channel = pusher.subscribe(`room-${roomId}`);


    type MyEventPayload = {
      message: string;
      user: {id: number; name: string; email: string };
      timestamp?: string;
    }

    // Listen for messages
    channel.bind('my-event', (data: MyEventPayload) => {
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
      pusher.disconnect();
    };
  }, [isOpen, roomId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/send-room-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({ 
          message: newMessage,
          roomId: roomId 
        }),
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
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l border-sidebar-border shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border bg-neutral-100 dark:bg-neutral-800">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-foreground">Room Chat</h3>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-neutral-400'}`} />
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
            <p>No messages yet.</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex flex-col space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">
                  {msg.user ? msg.user.name : 'System'}
                </span>
                <span>{formatTime(msg.timestamp)}</span>
              </div>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-2 text-sm text-foreground">
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-sidebar-border p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-muted-foreground"
            disabled={isLoading || !isConnected}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isLoading || !isConnected}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        {!isConnected && (
          <p className="text-xs text-red-500 mt-1">Disconnected - trying to reconnect...</p>
        )}
      </div>
    </div>
  );
};

export default RoomChat;
