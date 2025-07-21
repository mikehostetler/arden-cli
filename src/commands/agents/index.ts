import { Command } from "commander";
import { list } from "./list";
import { leaderboard } from "./leaderboard";

export const agentsCommand = new Command("agents")
  .description("Manage agents")
  .addCommand(list())
  .addCommand(leaderboard());
