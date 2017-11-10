
import * as Express from "express";
import * as Http from "http";
import * as parser from "body-parser";
import Router = Express.Router;
import * as admin from "firebase-admin";

require("dotenv").config();
const config = {
    firebase: {
        databaseURL: process.env.firebase_database_url,
    }
};
const serviceAccount = {
    type: process.env.firebase_type,
    project_id: process.env.firebase_project_id,
    private_key_id: process.env.firebase_private_key_id,
    private_key: process.env.firebase_private_key,
    client_email: process.env.firebase_client_email,
    client_id: process.env.firebase_client_id,
    auth_uri: process.env.firebase_auth_uri,
    token_uri: process.env.firebase_token_uri,
    auth_provider_x509_cert_url: process.env.firebase_auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.firebase_client_x509_cert_url,
};

const MASTER_TOKEN = process.env.master_token;

export interface SlackCallback {
    actions: [
        {
            name: string;
            value: string;
            type: string;
        }
    ],
    callback_id: string;
    team: {
        id: string;
        domain: string;
    },
    channel: {
        id: string;
        name: string;
    },
    user: {
        id: string;
        name: string;
    },
    action_ts: string;
    message_ts: string;
    attachment_id: string;
    token: string;
    original_message: {
        text: string;
        attachments: [
            {
                title: string;
                fields: [{
                    title: string;
                    value: string;
                    short: boolean;
                }],
                author_name: string;
                author_icon: string;
                image_url: string;
            }
        ]
    },
    response_url: string;
    trigger_id: string;
}

export class ExpressServer {
    fb: admin.app.App;

    constructor(port: number) {
        const app: Express.Application = Express();
        const server = Http.createServer(app);
        const router = Router();

        this.fb = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as any),
            databaseURL: config.firebase.databaseURL,
        } as any);

        app.use(parser.json());
        app.use(parser.urlencoded({ extended: false }));

        app.use(Express.static("public"));
        app.get("/", (req, res) => {
            res.sendFile(__dirname + "/public/index.html");
        });

        router.get("/version", (req, res) => {
            res.send("API version 1.");
        });

        router.post("/slack/callback", (req, res) => {
            console.log("/slack/callback ", req.body.payload.callback_id);
            const callbackInfo: SlackCallback = req.body.payload;
            const path = "slack/callback";
            if(callbackInfo.callback_id){
                this.push(path, callbackInfo.callback_id, callbackInfo).then((result) => {
                    console.log("posted");
                }).catch((error) => {
                    console.error(error);
                });
            }
            res.send("処理中だよ...");
        });

        // tokenを確認したい
        // app.use("/api/", this.checkBearerToken);
        app.use("/api/v1", router);
        server.listen(port, () => console.log("start"));
    }

    // checkBearerToken(req, res, next) {
    //     let result = false;
    //     const token = req.headers.authorization;
    //     if(token === "Bearer "+MASTER_TOKEN) {
    //         next();
    //     }else {
    //         res.send("You must need a bearer token.");
    //     }
    // }

    generateId(targetPath: string): string {
        return this.fb.database().ref().child(targetPath).push().key;
    }

    // get(path: string, id?: string) {
    //     return new Promise<any>((resolve, reject) => {
    //         console.log("get:", path);
    //         const userref: admin.database.Reference
    //             = this.fb.database().ref(path);
    //         userref.on("value", (snapshot) => {
    //             console.log("snapshot: ", snapshot.val());
    //         });
    //     });
    // }

    push(targetPath: string, id: string, entity: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const path = targetPath + "/" + id;
            this.fb.database().ref(path).set(entity).then((result) => {
                resolve({ result, path });
            }).catch((error) => {
                reject(error);
            });
        });
    }


}

