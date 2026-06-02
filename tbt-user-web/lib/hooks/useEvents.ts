"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { eventsService } from "@/lib/api/services/events.service";

export const useEvents = (params: { page?: number; limit?: number; search?: string } = {}) =>
  useQuery({
    queryKey: ["events", params],
    queryFn: async () => {
      const res = await eventsService.listEvents(params);
      return res;
    },
    staleTime: 60 * 1000,
  });

export const useEvent = (id: string) =>
  useQuery({
    queryKey: ["events", id],
    queryFn: async () => {
      const res = await eventsService.getEvent(id);
      return res.data;
    },
    enabled: !!id,
  });

export const useWebinars = (params: { page?: number; limit?: number; status?: string } = {}) =>
  useQuery({
    queryKey: ["webinars", params],
    queryFn: async () => {
      const res = await eventsService.listWebinars(params);
      return res;
    },
    staleTime: 60 * 1000,
  });

export const useWebinar = (id: string) =>
  useQuery({
    queryKey: ["webinars", id],
    queryFn: async () => {
      const res = await eventsService.getWebinar(id);
      return res.data;
    },
    enabled: !!id,
  });

export const useRegisterEvent = () =>
  useMutation({
    mutationFn: (id: string) => eventsService.registerForEvent(id),
  });
