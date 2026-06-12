import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export function useSupabaseRealtime() {
  const queryClient = useQueryClient();
  const { org } = useAuth();

  useEffect(() => {
    if (!supabase || !org) return;

    // Listen to changes in audit_results, videos, and channels tables
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'audit_results',
          filter: `org_id=eq.${org.id}`,
        },
        (payload) => {
          console.log('Realtime update on audit_results:', payload);
          // Invalidate relevant queries to instantly refetch
          queryClient.invalidateQueries({ queryKey: ["auditReports", org.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboardOverview", org.id] });
          queryClient.invalidateQueries({ queryKey: ["auditResults", org.id] });
          // Note: Ideally, we should also invalidate specific video queries if payload has video_id
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
        },
        (payload) => {
          console.log('Realtime update on videos:', payload);
          queryClient.invalidateQueries({ queryKey: ["channels", org.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboardOverview", org.id] });
          queryClient.invalidateQueries({ queryKey: ["flaggedVideos", org.id] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to Supabase Realtime');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, org]);
}
