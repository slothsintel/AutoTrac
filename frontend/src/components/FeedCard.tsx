import React from "react";
import { motion } from "framer-motion";

type FeedCardProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  icon?: React.ReactNode;        // icon for section
  children?: React.ReactNode;
  index?: number;
};

export default function FeedCard({
  title,
  subtitle,
  right,
  icon,
  children,
  index = 0,
}: FeedCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.25,
        ease: "easeOut",
        delay: index * 0.04,
      }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="
        bg-white dark:bg-neutral-800
        border border-neutral-200 dark:border-neutral-700
        rounded-2xl shadow-sm p-4 mb-3
      "
    >
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-neutral-700 dark:text-neutral-300">
              {icon}
            </span>
          )}

          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {title}
            </h3>

            {subtitle && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {right}
      </header>

      <div className="text-sm text-neutral-900 dark:text-neutral-100">
        {children}
      </div>
    </motion.article>
  );
}
