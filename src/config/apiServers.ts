// src/config/apiServers.ts

interface APIServer {
    name: string;
    url: string;
    checkpoints: string[];
    loras: string[];
}

const apiServers: APIServer[] = [
    {
        name: "Nebula (Fast)",
        url: "http://192.168.1.118:7860",
        checkpoints: [
            "Turbo\\level4sdxlAlphaV04",
            "epicphotogasm_ultimateFidelity",
        ],
        loras: [""],
    },
    {
        name: "Orion (Slow)",
        url: "http://192.168.3.217:7860",
        checkpoints: ["epicphotogasm_ultimateFidelity"],
        loras: [""],
    },
];

export default apiServers;
