import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindMessagesResponse } from "./types";

interface IParams {
  instanceName: string;
  remoteJid: string;
}

const queryKey = (params: Partial<IParams>) => ["chats", "findMessages", JSON.stringify(params)];

export const findMessages = async ({ instanceName, remoteJid }: IParams) => {
  const basePayload = {
    where: { key: { remoteJid } },
  };

  const firstResponse = await api.post(`/chat/findMessages/${instanceName}`, basePayload);
  const firstMessages = firstResponse.data?.messages;

  if (!firstMessages?.records) {
    return firstResponse.data;
  }

  const totalPages = Number(firstMessages.pages || 1);
  const allRecords = [...firstMessages.records];

  if (totalPages > 1) {
    const pageResponses = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        api.post(`/chat/findMessages/${instanceName}`, {
          ...basePayload,
          page: index + 2,
        }),
      ),
    );

    pageResponses.forEach((response) => {
      const records = response.data?.messages?.records;
      if (Array.isArray(records)) {
        allRecords.push(...records);
      }
    });
  }

  return allRecords;
};

export const useFindMessages = (props: UseQueryParams<FindMessagesResponse> & Partial<IParams>) => {
  const { instanceName, remoteJid, ...rest } = props;
  return useQuery<FindMessagesResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, remoteJid }),
    queryFn: () => findMessages({ instanceName: instanceName!, remoteJid: remoteJid! }),
    enabled: !!instanceName && !!remoteJid,
  });
};
