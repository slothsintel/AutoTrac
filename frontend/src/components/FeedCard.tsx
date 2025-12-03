import React from "react";
import { motion } from "framer-motion";

type FeedCardProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  /** Optional: index in a list, used for slight staggered animation */
  index?: number;
};

export default function FeedCard({
  title,
  subtitle,
  right,
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
        delay: index * 0.04, // small stagger if you ever pass index
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

        {right}
      </header>

      <div className="text-sm text-neutral-900 dark:text-neutral-100">
        {children}
      </div>
    </motion.article>
  );
}
