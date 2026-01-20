'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { User } from '@/lib/types';
import { useToast } from './Toast';

interface ChatMessage {
  id: string;
  message: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  users: {
    id: string;
    name: string;
    image: string;
  };
}

interface GroupChatProps {
  teamId: string;
  currentUser: {
    id: string;
    name: string;
    avatar: string;
  };
}

const GroupChat: React.FC<GroupChatProps> = ({ teamId, currentUser }) => {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/chat?limit=50`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [teamId]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_messages',
          filter: `team_id=eq.${teamId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the full message with user data
            const res = await fetch(`/api/teams/${teamId}/chat?limit=1&offset=0`);
            if (res.ok) {
              const data = await res.json();
              if (data.messages && data.messages.length > 0) {
                const newMsg = data.messages[data.messages.length - 1];
                setMessages((prev) => {
                  // Check if message already exists
                  if (prev.some((m) => m.id === newMsg.id)) {
                    return prev;
                  }
                  return [...prev, newMsg];
                });
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update the message in the list
            const updatedMessage = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMessage.id
                  ? { ...msg, ...updatedMessage }
                  : msg
              )
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove the message from the list
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.showError(error.error || 'Failed to send message');
        setNewMessage(messageText); // Restore message on error
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.showError('Failed to send message. Please try again.');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/chat/${messageId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        toast.showError(error.error || 'Failed to delete message');
      } else {
        setDeletingMessageId(null);
        toast.showSuccess('Message deleted');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.showError('Failed to delete message. Please try again.');
    }
  };

  const handleStartEdit = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditText(message.message);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editText.trim()) {
      handleCancelEdit();
      return;
    }

    try {
      const res = await fetch(`/api/teams/${teamId}/chat/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: editText.trim() }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.showError(error.error || 'Failed to update message');
      } else {
        setEditingMessageId(null);
        toast.showSuccess('Message updated');
        setEditText('');
      }
    } catch (error) {
      console.error('Failed to update message:', error);
      toast.showError('Failed to update message. Please try again.');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isOwnMessage = (message: ChatMessage) => {
    return message.user_id === currentUser.id;
  };

  if (isLoading) {
    return (
      <div className="glass p-8 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm">Loading chat...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-6 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent flex flex-col h-[600px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Group Chat</h3>
        <span className="text-xs text-gray-400">{messages.length} messages</span>
      </div>

      {/* Messages container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <i className="fa-solid fa-comments text-4xl text-gray-500 mb-4"></i>
              <p className="text-gray-400 text-sm">No messages yet</p>
              <p className="text-gray-500 text-xs mt-1">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 group relative ${
                isOwnMessage(message) ? 'flex-row-reverse' : ''
              }`}
            >
              <img
                src={message.users?.image || '/default-avatar.png'}
                alt={message.users?.name || 'User'}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
              <div
                className={`flex flex-col max-w-[70%] ${
                  isOwnMessage(message) ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-300">
                    {message.users?.name || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                {editingMessageId === message.id ? (
                  <div className="flex gap-2 w-full">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(message.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-accent"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(message.id)}
                      className="px-3 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isOwnMessage(message)
                        ? 'bg-accent text-white'
                        : 'bg-white/5 text-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.message}
                    </p>
                    {message.updated_at !== message.created_at && (
                      <span className="text-xs opacity-70 mt-1 block">
                        (edited)
                      </span>
                    )}
                  </div>
                )}
                {isOwnMessage(message) && editingMessageId !== message.id && (
                  <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(message)}
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                      title="Edit message"
                    >
                      <i className="fa-solid fa-edit"></i>
                    </button>
                    <button
                      onClick={() => setDeletingMessageId(message.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      title="Delete message"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                )}
              </div>
              {/* Delete confirmation popup */}
              {deletingMessageId === message.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl z-10">
                  <div className="bg-white/10 border border-white/20 rounded-xl p-4 max-w-xs mx-4">
                    <p className="text-sm text-gray-200 mb-4 text-center">
                      Are you sure you want to delete this message?
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingMessageId(null)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-accent transition-colors"
          maxLength={5000}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="px-6 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
        >
          {isSending ? (
            <i className="fa-solid fa-spinner fa-spin"></i>
          ) : (
            <i className="fa-solid fa-paper-plane"></i>
          )}
        </button>
      </form>
    </div>
  );
};

export default GroupChat;

