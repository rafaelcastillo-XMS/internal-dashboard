import { clients } from "@/data/dummy"

export function getClients() {
    return clients
}

export function getClientById(clientId?: string) {
    return clients.find(client => client.id === clientId) ?? clients[0]
}
