import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getWeatherForecast } from "@/lib/weather";

export const weatherRouter = router({
  /**
   * Get 7-day weather forecast for a given lat/lng.
   * Public procedure — used on both dashboard and customer booking form.
   */
  getForecast: publicProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
    )
    .query(async ({ input }) => {
      return getWeatherForecast(input.lat, input.lng);
    }),
});
