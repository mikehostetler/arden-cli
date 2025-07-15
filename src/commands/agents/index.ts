import { Command } from "commander";
import { list } from "./list";
import { leaderboard } from "./leaderboard";

export function agentsCommand(): Command {
  const command = new Command("agents")
    .description("Manage agents");

  command.addCommand(list());
  command.addCommand(leaderboard());

  return command;
}
