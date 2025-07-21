import { Command } from "commander";
import { leaderboard } from "./leaderboard";

export const usersCommand = new Command("users")
  .description("Manage users")
  .addCommand(leaderboard());
