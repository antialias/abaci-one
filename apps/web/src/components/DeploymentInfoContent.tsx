import { Clock, GitBranch, GitCommit, Package, Server } from "lucide-react";
import type React from "react";
import buildInfo from "@/generated/build-info.json";
import { css } from "../../styled-system/css";
import { hstack, vstack } from "../../styled-system/patterns";

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function getTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

export function DeploymentInfoContent() {
  return (
    <div className={vstack({ alignItems: "stretch", gap: "4" })}>
      <InfoRow
        icon={<Package size={18} />}
        label="Version"
        value={buildInfo.version}
      />

      <InfoRow
        icon={<Clock size={18} />}
        label="Build Time"
        value={
          <div className={vstack({ alignItems: "flex-start", gap: "1" })}>
            <span>{formatTimestamp(buildInfo.buildTimestamp)}</span>
            <span className={css({ fontSize: "sm", color: "gray.600" })}>
              {getTimeAgo(buildInfo.buildTimestamp)}
            </span>
          </div>
        }
      />

      {buildInfo.git.branch && (
        <InfoRow
          icon={<GitBranch size={18} />}
          label="Branch"
          value={
            <span
              className={css({
                fontFamily: "mono",
                fontSize: "sm",
                backgroundColor: "gray.100",
                padding: "1 2",
                borderRadius: "sm",
              })}
            >
              {buildInfo.git.branch}
              {buildInfo.git.isDirty && (
                <span className={css({ color: "orange.600", marginLeft: "2" })}>
                  (dirty)
                </span>
              )}
            </span>
          }
        />
      )}

      {buildInfo.git.commitShort && (
        <InfoRow
          icon={<GitCommit size={18} />}
          label="Commit"
          value={
            <div className={vstack({ alignItems: "flex-start", gap: "1" })}>
              <span
                className={css({
                  fontFamily: "mono",
                  fontSize: "sm",
                  backgroundColor: "gray.100",
                  padding: "1 2",
                  borderRadius: "sm",
                })}
              >
                {buildInfo.git.commitShort}
              </span>
              {buildInfo.git.commit && (
                <span
                  className={css({
                    fontFamily: "mono",
                    fontSize: "xs",
                    color: "gray.500",
                  })}
                >
                  {buildInfo.git.commit}
                </span>
              )}
            </div>
          }
        />
      )}

      {buildInfo.git.tag && (
        <InfoRow
          icon={<Package size={18} />}
          label="Tag"
          value={
            <span
              className={css({
                fontFamily: "mono",
                fontSize: "sm",
                backgroundColor: "blue.100",
                color: "blue.700",
                padding: "1 2",
                borderRadius: "sm",
              })}
            >
              {buildInfo.git.tag}
            </span>
          }
        />
      )}

      <InfoRow
        icon={<Server size={18} />}
        label="Environment"
        value={
          <span
            className={css({
              fontFamily: "mono",
              fontSize: "sm",
              backgroundColor:
                buildInfo.environment === "production"
                  ? "green.100"
                  : "yellow.100",
              color:
                buildInfo.environment === "production"
                  ? "green.700"
                  : "yellow.700",
              padding: "1 2",
              borderRadius: "sm",
            })}
          >
            {buildInfo.environment}
          </span>
        }
      />

      {buildInfo.buildNumber && (
        <InfoRow label="Build Number" value={buildInfo.buildNumber} />
      )}

      <InfoRow
        label="Node Version"
        value={
          <span className={css({ fontFamily: "mono", fontSize: "sm" })}>
            {buildInfo.nodeVersion}
          </span>
        }
      />
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className={hstack({
        justifyContent: "space-between",
        gap: "4",
        paddingY: "2",
        borderBottom: "1px solid",
        borderColor: "gray.100",
      })}
    >
      <div className={hstack({ gap: "2", color: "gray.700" })}>
        {icon}
        <span className={css({ fontWeight: "medium" })}>{label}</span>
      </div>
      <div className={css({ textAlign: "right", flex: "1" })}>{value}</div>
    </div>
  );
}
