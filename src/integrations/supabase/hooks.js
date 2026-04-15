import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './client';
import { useEffect } from 'react';

export const useTripData = () => {
    const queryClient = useQueryClient();

    const { data: trip, isLoading: isTripLoading } = useQuery({
        queryKey: ['pft_trips'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pft_trips')
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }
    });

    const { data: families, isLoading: isFamiliesLoading } = useQuery({
        queryKey: ['pft_families'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pft_families')
                .select('*, pft_checklists(*)');
            if (error) throw error;
            return data;
        },
        enabled: !!trip
    });

    const { data: itinerary, isLoading: isItineraryLoading } = useQuery({
        queryKey: ['pft_itinerary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pft_itinerary')
                .select('*');
            if (error) throw error;
            return data;
        },
        enabled: !!trip
    });

    const { data: meals, isLoading: isMealsLoading } = useQuery({
        queryKey: ['pft_meals'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pft_meals')
                .select('*');
            if (error) throw error;
            return data;
        },
        enabled: !!trip
    });

    const { data: activities, isLoading: isActivitiesLoading } = useQuery({
        queryKey: ['pft_activities'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pft_activities')
                .select('*');
            if (error) throw error;
            return data;
        },
        enabled: !!trip
    });

    const { data: expenses, isLoading: isExpensesLoading } = useQuery({
        queryKey: ['pft_expenses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pft_expenses')
                .select('*');
            if (error) throw error;
            return data;
        },
        enabled: !!trip
    });

    // Real-time subscriptions
    useEffect(() => {
        const channel = supabase
            .channel('pft_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pft_trips' }, () => queryClient.invalidateQueries(['pft_trips']))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pft_families' }, () => queryClient.invalidateQueries(['pft_families']))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pft_checklists' }, () => queryClient.invalidateQueries(['pft_families']))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pft_itinerary' }, () => queryClient.invalidateQueries(['pft_itinerary']))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pft_meals' }, () => queryClient.invalidateQueries(['pft_meals']))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pft_expenses' }, () => queryClient.invalidateQueries(['pft_expenses']))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pft_activities' }, () => queryClient.invalidateQueries(['pft_activities']))
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    // Construct the "doc" object compatible with the original App logic
    const doc = {
        families: families?.map(f => ({
            ...f,
            taskIds: f.pft_checklists?.map(c => c.id) || []
        })) || [],
        itineraryItems: itinerary?.map(i => ({
            ...i,
            startSlot: i.start_val,
            span: i.span_val
        })) || [],
        meals: meals || [],
        expenses: expenses || [],
        activities: activities || [],
        // We'll keep static locations and routes for now as they are complex to move 
        // without more schema work, but we can move them too if needed.
        locations: [], 
        routes: [] 
    };

    return {
        doc,
        isLoading: isTripLoading || isFamiliesLoading || isItineraryLoading || isMealsLoading || isActivitiesLoading || isExpensesLoading,
        trip
    };
};

export const useUpdateFamilyStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, status }) => {
            const { data, error } = await supabase
                .from('pft_families')
                .update({ status })
                .eq('id', id);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['pft_families']);
        }
    });
};

export const useUpdateChecklist = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, done }) => {
            const { data, error } = await supabase
                .from('pft_checklists')
                .update({ done })
                .eq('id', id);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['pft_families']);
        }
    });
};
