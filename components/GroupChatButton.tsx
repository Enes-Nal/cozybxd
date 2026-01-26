'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import GroupChatModal from './GroupChatModal';
import { useAnimations } from './AnimationProvider';

interface GroupChatButtonProps {
  teamId: string;
  currentUser: {
    id: string;
    name: string;
    avatar: string;
  };
}

const GroupChatButton: React.FC<GroupChatButtonProps> = ({ teamId, currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTime, setLastReadTime] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { experimentalAnimations } = useAnimations();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track unread messages
  useEffect(() => {
    if (isOpen) {
      // Mark as read when modal opens
      setLastReadTime(new Date());
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Subscribe to new messages for unread count
  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-unread-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          // Only count as unread if modal is closed and message is from another user
          if (!isOpen && payload.new.user_id !== currentUser.id) {
            const messageTime = new Date(payload.new.created_at);
            if (messageTime > lastReadTime) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, isOpen, currentUser.id, lastReadTime]);

  const handleOpen = () => {
    if (buttonRef.current && experimentalAnimations) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      });
    }
    setIsOpen(true);
  };

  const chatButton = (
    <button
      ref={buttonRef}
      onClick={handleOpen}
      className="w-14 h-14 bg-accent hover:bg-accent/80 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110 group"
      style={{ 
        position: 'fixed', 
        right: '1.5rem', 
        bottom: '1.5rem', 
        left: 'auto',
        top: 'auto',
        zIndex: 100,
        margin: 0,
        padding: 0
      }}
      title="Open chat"
    >
      <i className="fa-solid fa-comments text-xl"></i>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-pulse z-[101]">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <>
      {mounted && typeof window !== 'undefined' && !isOpen && createPortal(chatButton, document.body)}

      <GroupChatModal
        teamId={teamId}
        currentUser={currentUser}
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setButtonPosition(null);
        }}
        buttonPosition={buttonPosition}
      />
    </>
  );
};

export default GroupChatButton;

