
import * as Express from "express";
import * as Http from "http";
import * as parser from "body-parser";
import Router = Express.Router;
import * as admin from "firebase-admin";
import * as _ from "underscore";

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
        const firebaseDataMap: {[path: string]: {previous: any, next: any}} = {};

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

        router.get("/slack/callback", (req, res) => {
            console.log("[get] /slack/callback ");
            const allflag = req.query.all;
            const path = "slack/callback";
            let datamap = firebaseDataMap[path];
            if(!datamap){
                firebaseDataMap[path] = {previous: {}, next: {}};
                this.get(path).then((result)=>{
                    firebaseDataMap[path] = {
                        previous: result,
                        next: result,
                    }
                    this.subscribe(path, (result)=>{
                        firebaseDataMap[path] = {
                            previous: firebaseDataMap[path].previous,
                            next: result,
                        }
                    });
                    res.send(result);
                }).catch((error) => {
                    console.error(error);
                });
            }else {
                if(allflag){
                    res.send(datamap.next);
                }else {
                    const previousKeys = Object.keys(datamap.previous);
                    const nextKeys = Object.keys(datamap.next);
                    if(previousKeys.length === nextKeys.length) {
                        res.send([]);
                    }else {
                        const diff = _.difference(nextKeys, previousKeys);
                        const result = diff.map((key)=>datamap.next[key]);
                        firebaseDataMap[path].previous = datamap.next;
                        res.send(result);
                    }
                }
            }
        });

        router.post("/slack/callback", (req, res) => {
            console.log("[post] /slack/callback ", req.body.payload.callback_id);
            let payload = null;
            if(typeof req.body.payload === "string"){
                payload = JSON.parse(req.body.payload);
            }else {
                payload = req.body.payload;
            }
            const callbackInfo: SlackCallback = payload;
            const path = "slack/callback";
            if(callbackInfo.callback_id){
                const id = this.generateId(path);
                this.update(path, id, callbackInfo).then((result) => {
                    console.log("posted callback info");
                }).catch((error) => {
                    console.error(error);
                });
            }
            res.send("処理中だよ...");
        });

        // TODO tokenの確認とかしたい
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

    get(path: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const userref: admin.database.Reference
                = this.fb.database().ref(path);
            userref.once("value", (snapshot) => {
                const values = snapshot.val();
                resolve(values);
            });
        });
    }

    subscribe(path: string, callback: (data: any)=>void) {
        const userref: admin.database.Reference
            = this.fb.database().ref(path);
        userref.on("value", (snapshot) => {
            const values = snapshot.val();
            callback(values);
        });
    }

    unsubscribe(path: string) {
        const userref: admin.database.Reference
        = this.fb.database().ref(path);
        userref.off();
    }

    update(targetPath: string, id: string, entity: any): Promise<any> {
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

