/* eslint-disable react-refresh/only-export-components */
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { TOKEN_ID } from "@/lib/queries/token";

import { useFetchInstance } from "@/lib/queries/instance/fetchInstance";

import { Instance } from "@/types/evolution.types";

interface InstanceContextProps {
  instance: Instance | null;
  reloadInstance: () => Promise<void>;
}

export const InstanceContext = createContext<InstanceContextProps | null>(null);

export const useInstance = () => {
  const context = useContext(InstanceContext);
  if (!context) {
    throw new Error("useInstance must be used within an InstanceProvider");
  }
  return context;
};

interface InstanceProviderProps {
  children: ReactNode;
}

export const InstanceProvider: React.FC<InstanceProviderProps> = ({ children }): React.ReactNode => {
  const queryParams = useParams<{ instanceId: string }>();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const { data: instance, refetch: reloadInstance } = useFetchInstance({
    instanceId,
  });

  useEffect(() => {
    if (queryParams.instanceId) {
      setInstanceId(queryParams.instanceId);
    } else {
      setInstanceId(null);
    }
  }, [queryParams]);

  // Persist instance token/id/name to localStorage as soon as the instance is
  // loaded so chat queries (which authenticate via the instance token in the
  // axios interceptor) work even when the user lands directly on a chat route
  // without first visiting the dashboard.
  useEffect(() => {
    if (instance) {
      if (instance.id) localStorage.setItem(TOKEN_ID.INSTANCE_ID, instance.id);
      if (instance.name) localStorage.setItem(TOKEN_ID.INSTANCE_NAME, instance.name);
      if (instance.token) localStorage.setItem(TOKEN_ID.INSTANCE_TOKEN, instance.token);
    }
  }, [instance]);

  return (
    <InstanceContext.Provider
      value={{
        instance: instance ?? null,
        reloadInstance: async () => {
          await reloadInstance();
        },
      }}>
      {children}
    </InstanceContext.Provider>
  );
};
