import { Command } from "commander";
import { leaderboard } from "./leaderboard";

export function usersCommand(): Command {
  const command = new Command("users")
    .description("Manage users");

  command.addCommand(leaderboard());

  return command;
}
