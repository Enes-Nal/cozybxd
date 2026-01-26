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
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Scroll to bottom when messages change
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Check if user is near bottom of chat
  const checkScrollPosition = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceFromBottom < 200);
    setShowScrollToBottom(distanceFromBottom > 300);
  };

  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Set up scroll listener
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);
    checkScrollPosition(); // Initial check

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
    };
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

  // Format timestamp for display
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

  // Format timestamp for gap indicators
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / 86400000);
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  // Check if there's a significant time gap between messages (5 minutes)
  const hasTimeGap = (current: ChatMessage, previous: ChatMessage | null) => {
    if (!previous) return true;
    const currentTime = new Date(current.created_at).getTime();
    const previousTime = new Date(previous.created_at).getTime();
    return (currentTime - previousTime) > 5 * 60 * 1000; // 5 minutes
  };

  // Detect and format links in message text
  const formatMessageText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Group consecutive messages from the same user within 2 minutes
  const groupMessages = (messages: ChatMessage[]) => {
    if (messages.length === 0) return [];

    const grouped: Array<{ 
      message: ChatMessage; 
      isFirstInGroup: boolean; 
      isLastInGroup: boolean;
      showTimestamp: boolean;
    }> = [];
    
    for (let i = 0; i < messages.length; i++) {
      const current = messages[i];
      const prev = messages[i - 1];
      const next = messages[i + 1];
      
      const isFirstInGroup = !prev || 
        prev.user_id !== current.user_id || 
        (new Date(current.created_at).getTime() - new Date(prev.created_at).getTime()) > 120000; // 2 minutes
      
      const isLastInGroup = !next || 
        next.user_id !== current.user_id || 
        (new Date(next.created_at).getTime() - new Date(current.created_at).getTime()) > 120000;
      
      const showTimestamp = hasTimeGap(current, prev);
      
      grouped.push({ message: current, isFirstInGroup, isLastInGroup, showTimestamp });
    }
    
    return grouped;
  };

  const groupedMessages = groupMessages(messages);

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
    <div className="glass rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent flex flex-col h-[600px] overflow-hidden shadow-2xl">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-white/[0.02] to-transparent">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <i className="fa-solid fa-comments text-white text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">Group Chat</h3>
            <p className="text-xs text-gray-400">
              {messages.length === 0 
                ? 'No messages yet' 
                : messages.length === 1 
                ? '1 message' 
                : `${messages.length} messages`}
            </p>
          </div>
        </div>
      </div>

      {/* Messages container with background texture */}
      <div 
        ref={chatContainerRef}
        onScroll={checkScrollPosition}
        className="flex-1 overflow-y-auto px-4 py-6 relative bg-gradient-to-b from-transparent via-white/[0.01] to-transparent"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)',
          backgroundSize: '20px 20px'
        }}
      >
        {/* Delete confirmation popup */}
        {deletingMessageId && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
            <div className="bg-white/10 border border-white/20 rounded-xl p-4 max-w-xs mx-4 shadow-2xl">
              <p className="text-sm text-gray-200 mb-4 text-center">
                Are you sure you want to delete this message?
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handleDeleteMessage(deletingMessageId)}
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

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-accent hover:bg-accent/90 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 z-10"
            title="Scroll to bottom"
          >
            <i className="fa-solid fa-chevron-down text-sm"></i>
          </button>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-gray-300 text-base font-medium mb-1">Start the conversation</p>
              <p className="text-gray-500 text-sm">Send a message to begin chatting</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map(({ message, isFirstInGroup, isLastInGroup, showTimestamp }, index) => {
              const ownMessage = isOwnMessage(message);
              
              return (
                <React.Fragment key={message.id}>
                  {/* Timestamp divider for gaps */}
                  {showTimestamp && (
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(message.created_at)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex gap-2 group relative ${
                      ownMessage ? 'flex-row-reverse' : 'flex-row'
                    } ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}
                  >
                    {/* Avatar - only show for first message in group, incoming messages */}
                    {!ownMessage && (
                      <div className="w-8 h-8 flex-shrink-0">
                        {isFirstInGroup ? (
                          <img
                            src={message.users?.image || '/default-avatar.png'}
                            alt={message.users?.name || 'User'}
                            className="w-8 h-8 rounded-full object-cover shadow-md"
                          />
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>
                    )}

                    {/* Message content */}
                    <div
                      className={`flex flex-col ${
                        ownMessage ? 'items-end' : 'items-start'
                      } max-w-[75%] ${ownMessage ? 'mr-0' : 'ml-0'}`}
                    >
                      {/* Name - only show for first message in group, incoming messages */}
                      {!ownMessage && isFirstInGroup && (
                        <div className="mb-1.5 px-1">
                          <span className="text-xs font-semibold text-gray-300">
                            {message.users?.name || 'Unknown'}
                          </span>
                        </div>
                      )}

                      {/* Message bubble */}
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
                            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(message.id)}
                            className="px-4 py-2.5 bg-accent hover:bg-accent/90 rounded-xl text-sm font-medium transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`group/message relative px-4 py-2.5 rounded-2xl shadow-sm transition-all ${
                            ownMessage
                              ? 'bg-accent text-white rounded-br-md'
                              : 'bg-white/5 text-gray-100 rounded-bl-md border border-white/10'
                          } ${isFirstInGroup ? '' : ownMessage ? 'rounded-tr-md' : 'rounded-tl-md'} ${
                            isLastInGroup ? '' : ownMessage ? 'rounded-br-md' : 'rounded-bl-md'
                          } hover:shadow-md`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {formatMessageText(message.message)}
                          </p>
                          {message.updated_at !== message.created_at && (
                            <span className="text-xs opacity-60 mt-1 block">
                              (edited)
                            </span>
                          )}

                          {/* Hover actions */}
                          {ownMessage && (
                            <div className="absolute -right-14 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity z-10">
                              <button
                                onClick={() => handleStartEdit(message)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"
                                title="Edit"
                              >
                                <i className="fa-solid fa-pencil text-xs text-gray-300"></i>
                              </button>
                              <button
                                onClick={() => setDeletingMessageId(message.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/20 backdrop-blur-sm transition-colors"
                                title="Delete"
                              >
                                <i className="fa-solid fa-trash text-xs text-red-400"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Message input */}
      <div className="p-4 border-t border-white/10 bg-gradient-to-t from-white/[0.02] to-transparent shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex-shrink-0"
            title="Attach file"
          >
            <i className="fa-solid fa-paperclip text-gray-400 text-sm"></i>
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              maxLength={5000}
              disabled={isSending}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="Emoji"
            >
              <i className="fa-regular fa-face-smile text-gray-400 text-sm"></i>
            </button>
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={`w-10 h-10 flex items-center justify-center rounded-xl font-medium transition-all flex-shrink-0 ${
              newMessage.trim()
                ? 'bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/30'
                : 'bg-white/5 text-gray-500 cursor-not-allowed'
            } ${isSending ? 'opacity-50' : ''}`}
            title="Send message"
          >
            {isSending ? (
              <i className="fa-solid fa-spinner fa-spin text-sm"></i>
            ) : (
              <i className="fa-solid fa-paper-plane text-sm"></i>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GroupChat;

