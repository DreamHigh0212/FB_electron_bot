import { useState } from "react";
import { Button, Form, Input, message, Select, Upload, ConfigProvider, theme, Layout, InputNumber, Space, Checkbox } from "antd";
import { RcFile } from "antd/es/upload";
import { BsFillInboxesFill } from "react-icons/bs";
import Playwright from "playwright";
import Papa from "papaparse";
import "./App.css";
import Log from "./Log";
const playwright = window.require("playwright");
const { Dragger } = Upload;


interface Profile {
    "Facebook id": string;
    "Facebook password": string;
    "Proxy HTTP": string;
    proxyusername: string;
    "proxy password": string;
    "Cookies:": string;
    Post: string;
    replyTo?: string;
    replyText?: string;
}

interface Values {
    csv: RcFile;
    post: string;
    delayMin: string;
    delayMax: string;
    delayUnit: "minutes" | "seconds";
    likesMin: string;
    likesMax: string;
    timeout: string;
    timeoutUnit: "minutes" | "seconds";
    actionType: "doAll" | "justComment" | "justLike" | "justReply";
    proxy: boolean;
    typeDelay: boolean;
}


// get data from csv file and return it as array of objects
const getDataFromCsvAsArray = (csv: RcFile) => {

    return new Promise<Profile[]>((resolve, reject) => {
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            complete: function (results: any) {
                resolve(results.data as Profile[]);
            },
            error: function (error: any) {
                reject(error);
            }

        });
    });
};

// convert csv file into buffer

let stopped = false;
let paused = false;
function App() {
    const [csv, setCsv] = useState<RcFile | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [status, setStatus] = useState("");
    const [log, setLog] = useState<string[] | null>(null);
    const browserType = navigator.userAgent.includes("Macintosh") ? "webkit" : "chromium";
    async function submit(values: Values) {
        setIsRunning(true);
        setStatus("");
        console.log(values);
        function getRandomNumber(min: number, max: number) {
            const range = max - min + 1;
            const randomNumber = Math.random() * range + min;
            return Math.floor(randomNumber);
        }
        const timeoutMultiplier = values.timeoutUnit === "minutes" ? 60 : 1;
        const delayMultiplier = values.delayUnit === "minutes" ? 60 : 1;
        console.log("action", values.actionType);
        message.loading({ content: "Importing data", key: "uploading" });

        async function setUpBrowserWindow(i: number, csvData: Profile[], statusReport: string[]) {
            message.loading({
                content: `Logging in for profile ${i + 1}`,
                key: "uploading",
            });
            if (!csvData[i]) {
                message.error({
                    content: `Undefined profile  ${i + 1}`,
                    key: "uploading",
                });
                statusReport.push(`ERR: Undefined profile  ${i + 1}`);
                // continue;
            }
            const cookies = csvData[i]["Cookies:"];
            if (!cookies) {
                message.error({
                    content: `No cookies  for profile  ${i + 1}`,
                    key: "uploading",
                });
                statusReport.push(`ERR: No cookies  for profile  ${i + 1}`);
                // continue;
            }
            const proxyserver = csvData[i]["Proxy HTTP"];
            const proxyusername = csvData[i]["proxyusername"];
            const proxypassword = csvData[i]["proxy password"];
            if (!proxyserver || !proxyusername || !proxypassword) {
                message.error({
                    content: `No proxy data for profile  ${i + 1}`,
                    key: "uploading",
                });
                statusReport.push(`ERR: No proxy data for profile  ${i + 1}`);
                // continue;
            }

            const browser = await playwright[browserType].launch({
                timeout: 0,
                headless: false,
                proxy: values.proxy ? undefined : {
                    server: proxyserver,
                    username: proxyusername,
                    password: proxypassword,
                },
            });
            return { browser, cookies };
        }
        async function setUpBrowserContext(browser: any, cookies: any) {
            return await browser.newContext({
                storageState: {
                    cookies: (JSON.parse(cookies) as any[]).map(
                        (cookie: {
                              name: string;
                              value: string;
                              domain: string;
                              path: string;
                              expires: number;
                              httpOnly: boolean;
                              secure: boolean;
                              sameSite: "Strict" | "Lax" | "None";
                            }) => {
                            // capitalize samesite first letter
                            cookie.sameSite = (cookie.sameSite.charAt(0).toUpperCase() + cookie.sameSite.slice(1)) as unknown as | "Strict" | "Lax" | "None";
                            if (!["Strict", "Lax", "None"].includes(cookie.sameSite)) {
                                cookie.sameSite = "None";
                            }
                            return cookie;
                        }
                    ) as any[],
                },
            });
        }
        async function reactToComments(i: number, post: any, page: any, csvData: Profile[], statusReport: string[]) {
            message.info({
                key: "uploading",
                content: "Getting comments",
            });
            const allCommentsSelectorToggler = await post?.$("div.x6s0dn4.x78zum5.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xe0p6wg > div[role=\"button\"][tabindex=\"0\"] > span[dir=\"auto\"]");
            await allCommentsSelectorToggler!.click();
            await page?.waitForSelector("div[role=\"menu\"]");
            const allCommentsMenuSeletorMenu = await page?.$(
                "div[role=\"menu\"]"
            );
            const allCommentsMenuSeletorMenuItems = await allCommentsMenuSeletorMenu?.$$("div[role=\"menuitem\"]");
            const allCommentsItem = allCommentsMenuSeletorMenuItems![allCommentsMenuSeletorMenuItems!.length - 1];
            await allCommentsItem?.click();
            await post?.waitForSelector("div[role=\"article\"]");
            // click on the following button then then it will disapper but if they're still more comments it will be there(just continue clicking on it)
            while (true) {
                try {
                    const eleme = await post?.$("div.x78zum5.x13a6bvl.xexx8yu.x1pi30zi.x18d9i69.x1swvt13.x1n2onr6 > div.x78zum5.x1iyjqo2.x21xpn4.x1n2onr6");
                    if (!eleme) {
                        break;
                    }
                    await eleme!.click();
                } catch {
                    break;
                }
            }

            const comments = await post?.$$("div[role=\"article\"]");
            if (!comments) {
                message.error({
                    content: `Error getting comments for profile ${i + 1}`,
                    key: "uploading",
                });
                statusReport.push(`ERR: Error getting comments for profile ${i + 1}`);
                return;
            }
            if (comments.length === 0) {
                message.error({
                    content: `No comments found to react to for profile ${i + 1
                    }`,
                    key: "uploading",
                });
                statusReport.push(`ERR: No comments found to react to for profile ${i + 1}`);
                return;
            }

            // the comments must be liked at random too.
            const commentsToBeLiked: number[] = [];
            console.log(commentsToBeLiked);
            const minMumOfCommentsToBeLiked = +values.likesMin;
            // Max number of comments is half of the number of comments
            const maxMumOfCommentsToBeLiked = +values.likesMax;

            const randomNumberOfCommentsTobeLiked = Math.min(comment.length, Math.floor(
                Math.random() * (maxMumOfCommentsToBeLiked - minMumOfCommentsToBeLiked + 1) + minMumOfCommentsToBeLiked
            ));
            while (commentsToBeLiked.length < randomNumberOfCommentsTobeLiked) {
                const randomCommentIndex = Math.floor(
                    Math.random() * comments.length
                );
                if (!commentsToBeLiked.includes(randomCommentIndex)) {
                    commentsToBeLiked.push(randomCommentIndex);
                }
            }
            const leaveReaction = async (comment: any, j: number) => {
            // for (let i = 0; i < comments.length; i++) {
            // const comment = comments[i];
                if (commentsToBeLiked.includes(j)) {
                // const comment = comments[i];
                // check if comment is already liked, given Love, Care to it
                    let givenReaction = false;
                    message.info({
                        key: "uploading",
                        content: `Checking if comment ${j + 1} has been reacted on`,
                    });
                    // const reactions = ["Like", "Love", "Care", "Wow"];
                    const randomNum = Math.random();
                    let reaction = "Like";
                    if (randomNum > .6 && randomNum <= .72) {
                        reaction = "Love";
                    }
                    else if (randomNum > .72 && randomNum <= .88) {
                        reaction = "Care";
                    }
                    else if (randomNum > .88) {
                        reaction = "Wow";
                    }
                    console.log(randomNum, reaction);
    
                    try {
                    // const reaction = reactions[i];
                        const reactionButton = await comment.$(
                            `div[aria-label^="Remove ${reaction}"][role="button"]`
                        );
                        if (reactionButton) {
                            givenReaction = true;
                            return;
                        }
                    } catch (error) {
                    // continue;
                    }

                    if (givenReaction) {
                    // continue;
                    }
                    if (commentsToBeLiked.includes(j)) {
                        message.info({
                            key: "uploading",
                            content: `Reacting to comment ${j + 1}`,
                        });
                        const like = await comment.$(
                            "div[aria-label=\"Like\"][role=\"button\"]"
                        );
                        if (!like) {
                            message.error({
                                content: `Error getting like button for comment ${j + 1} for profile ${i + 1}`,
                                key: "uploading",
                            });
                            statusReport.push(`ERR: Error getting like button for comment ${j + 1} for profile ${i + 1}`);
        
                            return ;
                        }
                        await like?.hover();
                        await page.waitForSelector(
                            "div[aria-label=\"Reactions\"][role=\"dialog\"]",
                            {
                                timeout: 0,
                            }
                        );
                        const reactionsDialog = await page.$(
                            "div[aria-label=\"Reactions\"][role=\"dialog\"]"
                        );
                        const reactionButtons = await reactionsDialog?.$$(
                            "div[role='button']"
                        );
                        const randomIndex = Math.floor(Math.random() * 10) < 6 ? 0 : Math.floor(Math.random() * 4) + 1;
                        await reactionButtons![randomIndex === 3 ? 4 : randomIndex].click();
                        await page.waitForTimeout(1000);
                        statusReport.push(`reacted with ${reaction} on comment number ${j + 1}`);
                    }
                }
                // }

            };
            const leaveReactions = async (comments: any) => {
                for (let i = 0; i < comments.length; i++) {
                    await leaveReaction(comments[i], i);

                    console.log("left comment");
                }
            };
            await leaveReactions(comments);

            console.log("Finished with loop");
            message.success({
                content: `Successfully reacted to all comments for profile ${i + 1
                }`,
                key: "uploading",
            });

            await page?.waitForTimeout(3000);
        } 
        async function replyToComments(i: number, post: any, page: any, csvData: Profile[], statusReport: string[]) {
            message.info({
                key: "uploading",
                content: "Getting comments",
            });
            const allCommentsSelectorToggler = await post?.$("div.x6s0dn4.x78zum5.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xe0p6wg > div[role=\"button\"][tabindex=\"0\"] > span[dir=\"auto\"]");
            await allCommentsSelectorToggler!.click();
            await page?.waitForSelector("div[role=\"menu\"]");
            const allCommentsMenuSeletorMenu = await page?.$(
                "div[role=\"menu\"]"
            );
            const allCommentsMenuSeletorMenuItems = await allCommentsMenuSeletorMenu?.$$("div[role=\"menuitem\"]");
            const allCommentsItem = allCommentsMenuSeletorMenuItems![allCommentsMenuSeletorMenuItems!.length - 1];
            await allCommentsItem?.click();
            await post?.waitForSelector("div[role=\"article\"]");
            // click on the following button then then it will disapper but if they're still more comments it will be there(just continue clicking on it)
            while (true) {
                try {
                    const eleme = await post?.$("div.x78zum5.x13a6bvl.xexx8yu.x1pi30zi.x18d9i69.x1swvt13.x1n2onr6 > div.x78zum5.x1iyjqo2.x21xpn4.x1n2onr6");
                    if (!eleme) {
                        break;
                    }
                    await eleme!.click();
                } catch {
                    break;
                }
            }
            const replyTo = csvData[i]["replyTo"];
            const comment = await page?.$(`div[aria-label*="Comment by ${replyTo}"][role="article"]`);
            console.log("COMMENT", comment);
            if (!comment) {
                message.error({
                    content: `Error getting comments for profile ${i + 1}, commenter ${replyTo} not found`,
                    key: "uploading",
                });
                statusReport.push(`ERR: Error getting comments for profile ${i + 1}, commenter ${replyTo} not found`);
                return;
            }
            const reply = await comment?.$(
                "div[role=\"button\"][tabindex=\"0\"] >> text=\"Reply\""
            );
            console.log("ELEMENTS", reply);
            if (!reply) {
                message.error({
                    content: `Error getting reply button for comment ${i + 1}`,
                    key: "uploading",
                });
                statusReport.push(`ERR: Error getting reply button for comment for profile ${i + 1}`);
        
                return ;
            }
            await reply?.click();
            const parent = await comment.$("xpath=..");
            console.log(parent);
            const replyBox = await parent?.$(
                `div[aria-label*="Reply to ${replyTo}"][role="textbox"]`
            );
            await replyBox?.click();
            const replyText = csvData[i]["replyText"];

            if (replyText) {
                await post?.type(replyText, values.typeDelay ? undefined : { delay: 40 });
                await new Promise((resolve) => setTimeout(resolve, 1500));
                await page.keyboard.press("Enter");
                await new Promise((resolve) => setTimeout(resolve, 1500));
                statusReport.push(`replied with "${replyText}"`);
            }


            message.success({
                content: `Successfully replied to comment for profile ${i + 1
                }`,
                key: "uploading",
            });

            await page?.waitForTimeout(3000);
        } 
        async function comment(i: number, post: any, page: any, csvData: Profile[], statusReport: string[]) {
            let givenReaction = false;
            message.info({
                key: "uploading",
                content: "Checking if it has been reacted on",
            });
            const reactions = ["Like", "Love", "Care", "Wow"];
            for (let i = 0; i < reactions.length; i++) {
                try {
                    const reaction = reactions[i];
                    const reactionButton = await post?.$(
                        `div[aria-label="Remove ${reaction}"][role="button"]`
                    );
                    if (reactionButton) {
                        givenReaction = true;
                        break;
                    }
                } catch (error) {
                    message.error({
                        content: "Error checking if it has been reacted on",
                        key: "uploading",
                    });
                    statusReport.push(`ERR: Error checking if it has been reacted on ${i + 1}`);
                }
            }
            if (!givenReaction) {
                message.info({
                    content: "Reacting on the post",
                    key: "uploading",
                });
                const like = await post?.$(
                    "div[aria-label=\"Like\"][role=\"button\"][tabindex=\"0\"]"
                );
                await like?.hover();
                await page.waitForSelector(
                    "div[aria-label=\"Reactions\"][role=\"dialog\"]",
                    {
                        timeout: 0,
                    }
                );
                const reactionsDialog = await page.$(
                    "div[aria-label=\"Reactions\"][role=\"dialog\"]"
                );
                const reactionButtons = await reactionsDialog?.$$(
                    "div[role='button']"
                );
                    // random index(60 % chance of liking, 40 % chance of other reactions)
                const randomIndex = Math.random() < 0.6 ? 0 : 1 + Math.floor(Math.random() * 4);
                await reactionButtons![randomIndex === 3 ? 4 : randomIndex]?.click();
            }
            message.info({
                key: "uploading",
                content: "Commenting on the post",
            });

                
            const commentBox = await post?.$(
                "div[aria-label^=\"Write a comment\"][role=\"textbox\"]"
            );
            console.log(post);
            console.log(commentBox);
            await commentBox?.click();
            console.log("PAGELOADED");
            const posts = csvData[i]["Post"].split("\n");
            await commentBox?.type(posts[0], values.typeDelay ? undefined : { delay: 40 });
            // await commentBox?.type(posts[0]);
            await page.keyboard.press("Enter");
            while (true) {
                try {
                    const autoSpans = await post?.$$("span[dir=\"auto\"]");
                    const postingSpans = [];
                    for (let i = 0; i < autoSpans!.length; i++) {
                        const posting = await autoSpans![i].innerText();
                        if (posting === "Posting...") {
                            postingSpans.push(autoSpans![i]);
                        }
                    }
                    if (postingSpans.length > 0) {
                        await page.waitForTimeout(1000);
                    } else {
                        break;
                    }
                    statusReport.push("Commented on post");
                } catch (error) {
                    statusReport.push("ERR: Error Commenting on post");
                    break;
                }
            }
        }
        async function runPlaywrightScript(operation: "comment" | "like" | "reply" | "commentAndReply" , i: number, browser: any, csvData: Profile[], statusReport: string[], context: any) {
            try {
                console.log("Opreation: ", operation);
                const page = await context.newPage();
                let counter = 0;
                let interval: any;
                const waiting = () => {
                    try {
                        counter++;
                        console.log("waiting...", counter);
                        if (counter >= +values.timeout * timeoutMultiplier) {
                            clearInterval(interval);
                            statusReport.push("ERR: timed out.");
                            throw new Error("timeout");
                        }
                    } catch(e) {
                        console.error(e);
                        browser.close();
                    }
                };
                try {
                    //task will timeout after to let others continue
                    interval = setInterval(waiting ,1000);
                    try {
                        message.info({
                            key: "uploading",
                            content: "Opening the post",
                        });
                        await page.goto(values.post, {
                            waitUntil: "load",
                            timeout: 0,
                        });
                    } catch (error) {
                        message.error({
                            content: `Error Opening the post for profile ${i + 1}`,
                            key: "uploading",
                        });
                        statusReport.push(`ERR: Error Opening the post for profile ${i + 1}`);
                    }
                        
                    try {
                        message.info({
                            key: "uploading",
                            content: "Waiting for post to load",
                        });

                        await page.waitForSelector("div[aria-posinset=\"1\"]", {
                            timeout: 0,
                        });
                    } catch (error) {
                        message.error({
                            content: `Error Waiting for post to load for profile ${i + 1
                            }`,
                            key: "uploading",
                        });
                        statusReport.push(`ERR: Error Waiting for post to load for profile ${i + 1}`);
                    }
                    message.info({
                        key: "uploading",
                        content: "Selecting the first post",
                    });
    
                    const post = await page.$("div[aria-posinset=\"1\"]");
                    console.log("WATING TO LOAD");
                    await new Promise((resolve) => setTimeout(resolve, 1500));

                    if (operation === "comment") {
                        await comment(i, post, page, csvData, statusReport);
                    }
                    if (operation === "reply") {
                        await replyToComments(i, post, page, csvData, statusReport);
                    }
                    if (operation === "commentAndReply") {
                        await comment(i, post, page, csvData, statusReport);
                        await replyToComments(i, post, page, csvData, statusReport);
                    }
                    if (operation === "like") {
                        await reactToComments(i, post, page, csvData, statusReport);
                    }


                    await browser.close();
                    // message.success({
                    //     content: "Successfully completed all operations",
                    //     key: "uploading",
                    // });
                    // statusReport.push("Successfully completed all operations");
                    // set a timeout before the new index starts 
                    clearInterval(interval);
                    counter = 0;
                    const delay = getRandomNumber(+values.delayMin, +values.delayMax) * delayMultiplier;
                    const tick = () => {
                        setStatus(`(waiting: ${delay - counter})`);
                        counter++;
                    };
                    interval = setInterval(tick, 1000);
                    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
                    clearInterval(interval);
                    setStatus("");
                    // await the comment to be posted
                } catch (error) {
                    browser.close();
                    clearInterval(interval);
                    console.log("ERROR", error);
                    // message.error({
                    //     key: "uploading",
                    //     content: "Error: Not all operations completed Successfully",
                    // });
                    // statusReport.push("ERR: Not all operations completed Successfully");
                }
            }
                
            catch (error: any) {
                message.error({
                    content: `Error Logging in for profile ${i + 1}`,
                    key: "uploading",
                });
                statusReport.push(`ERR: Error Logging in for profile ${i + 1}`);
            }
        }
        async function waitForUnpause() {
            return new Promise((resolve: any) => {
                const interval = setInterval(() => {
                    console.log("waiting for unpause");
                    if (!paused) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });
        }
        
        // import data
        try {

            const csvData = await getDataFromCsvAsArray(csv!);
            console.log(csvData);
            message.success({ content: "Imported data", key: "uploading" });
            const statusReport: string[] = [];
            try {
                let i = 0;
                let j = 0;
                const likeLoop = async () => {
                    if (stopped || j >= csvData.length) {
                        stopped = false;
                        paused = false;
                        console.table(statusReport);
                        message.destroy();
                        setLog(statusReport);
                        setIsRunning(false);
                        setIsPaused(false);
                        return;
                    }
                    return new Promise((resolve: any) => {
                        setTimeout(async () => {
                            console.log(j);
                            statusReport.push(`*** Profile ${j + 1} ***`);
                            const { browser, cookies } = await setUpBrowserWindow(j, csvData, statusReport);
                            const context = await setUpBrowserContext(browser, cookies);
                            await runPlaywrightScript("like", j, browser, csvData, statusReport, context);
                            if (!paused) requestAnimationFrame(likeLoop);
                            else {
                                await waitForUnpause();
                                requestAnimationFrame(likeLoop);
                            } 
                            j++;
                            resolve();
                        }, 0); 
                    });
                };
                const commentLoop = async () => {
                    if (stopped || i >= csvData.length) {
                        if (values.actionType === "doAll" || values.actionType === "justLike") await likeLoop(); // Start the loop
                        else {
                            stopped = false;
                            paused = false;
                            console.table(statusReport);
                            message.destroy();
                            setLog(statusReport);
                            setIsRunning(false);
                            setIsPaused(false);
                        }
                        return;
                    }
                    return new Promise((resolve: any) => {
                        setTimeout(async () => {
                            console.log(i);
                            statusReport.push(`*** Profile ${i + 1} ***`);
                            if (values.actionType === "justComment") {
                                const { browser, cookies } = await setUpBrowserWindow(i, csvData, statusReport);
                                const context = await setUpBrowserContext(browser, cookies);
                                await runPlaywrightScript("comment", i, browser, csvData, statusReport, context);
                            }
                            if (values.actionType === "justReply") {
                                const { browser, cookies } = await setUpBrowserWindow(i, csvData, statusReport);
                                const context = await setUpBrowserContext(browser, cookies);
                                await runPlaywrightScript("reply", i, browser, csvData, statusReport, context);
                            }
                            if (values.actionType === "doAll") {
                                const { browser, cookies } = await setUpBrowserWindow(i, csvData, statusReport);
                                const context = await setUpBrowserContext(browser, cookies);
                                await runPlaywrightScript("commentAndReply", i, browser, csvData, statusReport, context);
                            }
                            if (!paused) requestAnimationFrame(commentLoop);
                            else {
                                await waitForUnpause();
                                requestAnimationFrame(commentLoop);
                            } 
                            i++;
                            resolve();
                        }, 0); 
                    });
                };
                
                if (values.actionType !== "justLike") await commentLoop(); // Start the loop
                else await likeLoop();
                
            } catch (error) {
                setIsRunning(false);
                message.error({
                    key: "uploading",
                    content: "Error ",
                });
            }
        } catch (error) {
            setIsRunning(false);
            // console.log(error)
            message.error({
                content: "Error importing data ",
                key: "uploading",
            });
            return;
        }
    }
    function stopLoop() {
        paused = false;
        stopped = true;
    }
    function pauseLoop() {
        paused = !paused;
        setIsPaused(paused);
    }

    return (
        <>
            <ConfigProvider
                theme={{
                    algorithm: theme.darkAlgorithm,
                    token: {
                        colorBgContainer: "#161b22",
                        colorBorder: "#30363d",
                        colorPrimary: "#005599"
                        // colorBgBase: '#555555',
                        // colorTextBase: '#FFFFFF',
                        // colorFillAlter: '#555555',
                    },
                }}
            >
                <Form
                    onFinish={(values) => {
                        submit({ ...values, csv: values.csv.file });
                    }}
                    layout="inline"
                    // className="bg-white shadow-xl rounded-md px-8 pt-6 pb-8 mb-4"
                >
                    {/* <h1>Facebook Bot</h1> */}
                    {/* <div className="column"> */}
                    <Layout style={{margin: "2em", backgroundColor: "#00000000"}}>
                        <Layout.Content style={{marginRight: "2em"}}>
                            <Form.Item
                                // check if the input is facebook post link
                                // initialValue={"https://www.facebook.com/151737801548866_180271624999515"}
                                rules={[
                                    {
                                        required: true,
                                        message: "Please input post link!",
                                    },
                                    {
                                        // pattern: new RegExp(
                                        // // regex for facebook post link
                                        //     "^(https?:\\/\\/)?" +
                                        //     "(www\\.)?" +
                                        //     "(m\\.)?" +
                                        //     "(web\\.)?" +
                                        //     "facebook.com\\/" +
                                        //     "[a-zA-Z0-9\\.\\-\\_\\/]+" +
                                        //     "(\\/posts\\/|_)" +
                                        //     "[0-9]" +
                                        //     "??[a-zA-Z0-9=&%]+"
                                        // ),
                                        message: "Enter valid post link!",
                                    },
                                ]}
                                name="post"
                                label="Post link"
                            >
                                <Input allowClear />
                            </Form.Item>
                            {/* Upload .csv */}
                            <Form.Item name="csv" style={{height: "180px"}} valuePropName="FileList">
                                <Dragger
                                    multiple={false}
                                    accept=".csv"
                                    beforeUpload={(file) => {
                                        setCsv(file);
                                        return false;
                                    }}
                                    maxCount={1}
                                    onRemove={() => setCsv(null)}
                                    style={{marginTop: "2em"}}
                                >
                                    <p className="ant-upload-drag-icon mx-auto w-fit">
                                        <BsFillInboxesFill className="w-fit" size={40} color="#005599" />
                                    </p>
                                    <p className="ant-upload-text">
                                      Click or drag CSV file to this area to upload
                                    </p>
 
                                </Dragger>
                            </Form.Item>
                            {/*  he can pick time he wants just select if the given time is in hours, minutes, seconds or milleseconds */}
                            {/* </div> */}
                            <Space style={{marginTop: "1em", width: "100%", display: "flex", justifyContent: "center"}}>
                                {!isRunning ? 
                                    <Button
                                        type="primary"
                                        // className="w-full bg-[#1b1ba0] mt-4 disabled:bg-[#ccc]"
                                        htmlType="submit"
                                        disabled={!csv}
                                        style={{width: "10em"}}
                                    >
                                    Start
                                    </Button>
                                    :
                                    <Button
                                        type="primary"
                                        onClick={pauseLoop}
                                        // className="w-full bg-[#1b1ba0] mt-4 disabled:bg-[#ccc]"
                                        style={{width: isPaused ? "16em" : "30em", backgroundColor: "#006600"}}
                                    >
                                        {isPaused ? `Resume ${status}` : `Pause ${status}`}
                                    </Button>
                                }
                                {paused &&
                                    <Button
                                        type="primary"
                                        onClick={stopLoop}
                                        // className="w-full bg-[#1b1ba0] mt-4 disabled:bg-[#ccc]"
                                        style={{width: "10em", backgroundColor: "#660000"}}
                                    >
                                        Stop
                                    </Button>
                                }
                                <Form.Item
                                    // label="Select Action"
                                    name="actionType"
                                    initialValue={"doAll"}
                                >
                                    {!isRunning && <Select
                                        // defaultValue={"commentAndLike"}
                                        // placeholder="Select time interval type"
                                        style={{width: "16em"}}
                                    >
                                        <Select.Option value="doAll">Comment, Like, and Reply</Select.Option>
                                        <Select.Option value="justComment">Just Comment</Select.Option>
                                        <Select.Option value="justLike">Just Like</Select.Option>
                                        <Select.Option value="justReply">Just Reply</Select.Option>
                                    </Select>}
            
                                </Form.Item>
                            </Space>
                        </Layout.Content>
          
                        {/* <div className="column"> */}
                        <Layout.Sider width="240" theme="dark" style={{backgroundColor: "#00000000"}}>
                            <p>Number of likes (range) :</p>
                            <Space>
                                <Form.Item
                                    name="likesMin"
                                    // label="Likes Min"
                                    initialValue={5}
                                    rules={[
                                        {
                                            required: true,
                                            message: "Please select minimum likes!",
                                        },
                                    ]}
                                    style={{margin: 0}}
                                >
                                    <InputNumber
                                        // allowClear
                                        type="number"
                                        min={0}
                                        max={100000}
                                    />
                                </Form.Item>-
                                <Form.Item
                                    name="likesMax"
                                    // label="Likes Max"
                                    initialValue={20}
                                    rules={[
                                        {
                                            required: true,
                                            message: "Please select maximum likes!",
                                        },
                                    ]}
                                    style={{margin: 0}}
                                >
                                    <InputNumber
                                        // allowClear
                                        type="number"
                                        min={0}
                                        max={100000}
                                    />
                                </Form.Item>
                            </Space>
                            <p>Time Delay (range) :</p>
                            <Space>
                                <Form.Item
                                    name="delayMin"
                                    // label="min"
                                    initialValue={5}
                                    style={{margin: 0}}
                                >
                                    <InputNumber
                                        // allowClear
                                        type="number"
                                        min={0}
                                        max={100000}
                                    />
                                </Form.Item>-
                                <Form.Item
                                    name="delayMax"
                                    // label="Time Delay Max"
                                    initialValue={20}
                                    style={{margin: 0}}
                                >
                                    <InputNumber
                                        // allowClear
                                        type="number"
                                        min={0}
                                        max={100000}
                                    />
                                </Form.Item>
                                <Form.Item
                                    // label="Select Action"
                                    name="delayUnit"
                                    initialValue={"seconds"}
                                    style={{margin: 0}}
                                >
                                    <Select
                                        // defaultValue={"commentAndLike"}
                                        // placeholder="Select time interval type"
                                    >
                                        <Select.Option value="seconds">s</Select.Option>
                                        <Select.Option value="minutes">m</Select.Option>
                                    </Select>
            
                                </Form.Item>
                            </Space>
                            <p>Timeout:</p>
                            <Space>
                                <Form.Item
                                    name="timeout"
                                    // label="Time Out"
                                    initialValue={40}
                                    style={{margin: 0}}
                                >
                                    <InputNumber
                                        // allowClear
                                        type="number"
                                        min={0}
                                        max={100000}
                                    />
                                </Form.Item>
                                <Form.Item
                                    // label="Select Action"
                                    name="timeoutUnit"
                                    initialValue={"seconds"}
                                >
                                    <Select
                                        // defaultValue={"commentAndLike"}
                                        // placeholder="Select time interval type"
                                    >
                                        <Select.Option value="seconds">s</Select.Option>
                                        <Select.Option value="minutes">m</Select.Option>
                                    </Select>
            
                                </Form.Item>
                            </Space>
                            <Space>
                                <Form.Item
                                // label="Select Action"
                                    name="typeDelay"
                                    valuePropName="checked"
                                    // initialValue={false}
                                >
                                    <Checkbox>Disable Type Delay</Checkbox>
                                </Form.Item>
                            </Space>
                            <Space>
                                <Form.Item
                                // label="Select Action"
                                    name="proxy"
                                    valuePropName="checked"
                                    // initialValue={false}
                                >
                                    <Checkbox>Disable Proxy</Checkbox>
                                </Form.Item>
                            </Space>
                            {/* </div> */}
                        </Layout.Sider>
                    </Layout>
                </Form>
            </ConfigProvider>
            {log && <Log log={log} setLog={setLog} />}
        </>
    );
}

export default App;
