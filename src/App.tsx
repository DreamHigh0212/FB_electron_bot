import { useState } from "react";
import { Button, Form, Input, message, Select, Upload } from "antd";
import { RcFile } from "antd/es/upload";
import { BsFillInboxesFill } from "react-icons/bs";
import Playwright from "playwright";
const fs = window.require("fs");
const playwright = window.require("playwright");
const csv = window.require("csv-parser");
const path = window.require("path");
const { Dragger } = Upload;

interface Profile {
  "Facebook id": string;
  "Facebook password": string;
  "Proxy HTTP": string;
  proxyusername: string;
  "proxy password": string;
  "Cookies:": string;
  Post: string;
}
// get data from csv file and return it as array of objects
const getDataFromCsvAsArray = (path: string) => {
  const profiles: Profile[] = [];

  return new Promise<Profile[]>((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(csv())
      .on("data", (data: Profile) => profiles.push(data))
      .on("end", () => {
        resolve(profiles);
      })
      .on("error", (error: any) => {
        reject(error);
      });
  });
};

// let checkIfTheyAreMoreComments = async (post: Playwright.ElementHandle<HTMLElement | SVGElement> ) => {
//   try {

//     return true;
//   } catch (error) {
//     return false;
//   }
// }

// convert csv file into buffer
const convertcsvIntoBuffer = (csv: RcFile) => {
  return new Promise<Buffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(Buffer.from(reader.result as ArrayBuffer));
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsArrayBuffer(csv);
  });
};
function App() {
  const [csv, setCsv] = useState<RcFile | null>(null);
  // const [started, setStarted] = useState(false);
  const submit = async (values: {
    csv: RcFile;
    post: string;
    time: number;
    timeType: "Hours" | "Minutes" | "Seconds" | "Milliseconds";
  }) => {
    // setStarted(true);
    const csvBuffer = await convertcsvIntoBuffer(csv!);
    message.loading({ content: "Uploading...", key: "uploading" });

    try {
      if (!fs.existsSync(path.join(__dirname, "../cache"))) {
        fs.mkdirSync(path.join(__dirname, "../cache"));
      }
      // save file(buffer)
      const filePath = path.join(__dirname, "../cache/data.csv");

      fs.writeFileSync(filePath, csvBuffer);
      message.success({ content: "Uploaded csv", key: "uploading" });
    } catch (error) {
      console.log(error);
      message.error({ content: "Error uploading csv", key: "uploading" });
      // setStarted(false);
      return;
    }
    message.loading({ content: "Importing data", key: "uploading" });
    // import data
    try {
      const filePath = path.join(__dirname, "../cache/data.csv");
      const csvData = await getDataFromCsvAsArray(filePath);
      message.success({ content: "Imported data", key: "uploading" });
      try {
        for (let i = 0; i <= csvData.length; i++) {
          message.loading({
            content: `Logging in for profile ${i + 1}`,
            key: "uploading",
          });
          if (!csvData[i]) {
            message.error({
              content: `Undefined profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let cookies = csvData[i]["Cookies:"];
          if (!cookies) {
            message.error({
              content: `No cookies  for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let proxyserver = csvData[i]["Proxy HTTP"];
          let proxyusername = csvData[i]["proxyusername"];
          let proxypassword = csvData[i]["proxy password"];
          if (!proxyserver || !proxyusername || !proxypassword) {
            message.error({
              content: `No proxy data for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          const browser = await playwright.chromium.launch({
            timeout: 0,
            headless: false,
            // proxy: {
            //   server: proxyserver,
            //   username: proxyusernfame,
            //   password: proxypassword,
            // },
          });
          await browser
            .newContext({
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
                    cookie.sameSite = (cookie.sameSite.charAt(0).toUpperCase() +
                      cookie.sameSite.slice(1)) as unknown as
                      | "Strict"
                      | "Lax"
                      | "None";
                    if (!["Strict", "Lax", "None"].includes(cookie.sameSite)) {
                      cookie.sameSite = "None";
                    }
                    return cookie;
                  }
                ) as any[],
              },
            })

            .then(async (context: Playwright.BrowserContext) => {
              const page = await context.newPage();
              try {
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
                }
                const reactions = ["Like", "Love", "Care", "Haha", "Wow"];
                try {
                  message.info({
                    key: "uploading",
                    content: "Waiting for post to load",
                  });
                  await page.waitForSelector(`div[aria-posinset="1"]`, {
                    timeout: 0,
                  });
                } catch (error) {
                  message.error({
                    content: `Error Waiting for post to load for profile ${
                      i + 1
                    }`,
                    key: "uploading",
                  });
                }
                message.info({
                  key: "uploading",
                  content: "Selecting the first post",
                });
                const post = await page.$(`div[aria-posinset="1"]`);
                let givenReaction = false;
                message.info({
                  key: "uploading",
                  content: "Checking if it has been reacted on",
                });
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
                  }
                }
                if (!givenReaction) {
                  message.info({
                    content: "Reacting on the post",
                    key: "uploading",
                  });
                  const like = await post?.$(
                    `div[aria-label="Like"][role="button"][tabindex="0"]`
                  );
                  await like?.hover();
                  await page.waitForSelector(
                    `div[aria-label="Reactions"][role="dialog"]`,
                    {
                      timeout: 0,
                    }
                  );
                  const reactionsDialog = await page.$(
                    `div[aria-label="Reactions"][role="dialog"]`
                  );
                  const reactionButtons = await reactionsDialog?.$$(
                    "div[role='button']"
                  );
                  // random index(60 % chance of liking, 40 % chance of other reactions)
                  const randomIndex =
                    Math.random() < 0.6 ? 0 : 1 + Math.floor(Math.random() * 4);
                  console.log(randomIndex);
                  await reactionButtons![randomIndex]?.click();
                }
                message.info({
                  key: "uploading",
                  content: "Commenting on the post",
                });
                const commentBox = await post?.$(
                  `div[aria-label="Write a comment"][role="textbox"]`
                );
                await commentBox?.click();
                await commentBox?.type(csvData[i]["Post"], { delay: 30 });
                await page.keyboard.press("Enter");
                const comments = await post?.$$(`div[role="article"]`);

                message.info({
                  content: "Logging out",
                  key: "uploading",
                });
                // await the comment to be posted(by checking if the post contain the comment which don't have )
                let autoSpans = await post?.$$(`span[dir="auto"]`);
                // check if there is an autospan which has `Posting...` as text in it
                while (
                  autoSpans!.some((span) =>
                    span!.innerText().then((text) => text === "Posting...")
                  )
                ) {
                  await page.waitForTimeout(1000);
                  autoSpans = await post?.$$(`span[dir="auto"]`);
                }
                await page.waitForTimeout(
                  values.timeType === "Minutes"
                    ? values.time * 60 * 1000
                    : values.timeType === "Hours"
                    ? values.time * 60 * 60 * 1000
                    : values.timeType === "Seconds"
                    ? values.time * 1000
                    : 0
                );

                // await the comment to be posted
              } catch (error) {
                message.error({
                  key: "uploading",
                  content: "Error commenting on the post",
                });
              }
            })
            .catch((error: any) => {
              message.error({
                content: `Error Logging in for profile ${i + 1}`,
                key: "uploading",
              });
            });
        }

        // message.success({
        //   content: "Successfully commented on post and liked it",
        //   key: "uploading",
        // });

        for (let i = 0; i <= csvData.length; i++) {
          message.loading({
            content: `Logging in for profile ${i + 1}`,
            key: "uploading",
          });
          if (!csvData[i]) {
            message.error({
              content: `Undefined profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let cookies = csvData[i]["Cookies:"];
          if (!cookies) {
            message.error({
              content: `No cookies  for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let proxyserver = csvData[i]["Proxy HTTP"];
          let proxyusername = csvData[i]["proxyusername"];
          let proxypassword = csvData[i]["proxy password"];
          if (!proxyserver || !proxyusername || !proxypassword) {
            message.error({
              content: `No proxy data for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }

          const browser = await playwright.chromium.launch({
            timeout: 0,
            headless: false,
            // proxy: {
            //   server: proxyserver,
            //   username: proxyusername,
            //   password: proxypassword,
            // },
          });

          await browser
            .newContext({
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
                    cookie.sameSite = (cookie.sameSite.charAt(0).toUpperCase() +
                      cookie.sameSite.slice(1)) as unknown as
                      | "Strict"
                      | "Lax"
                      | "None";
                    if (!["Strict", "Lax", "None"].includes(cookie.sameSite)) {
                      cookie.sameSite = "None";
                    }
                    return cookie;
                  }
                ) as any[],
              },
            })
            .then(async (context: Playwright.BrowserContext) => {
              const page = await context.newPage();
              try {
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
                }
                const reactions = ["Like", "Love", "Care", "Haha", "Wow"];
                try {
                  await page.waitForSelector(`div[aria-posinset="1"]`, {
                    timeout: 0,
                  });
                } catch {
                  message.error({
                    content: `Error Waiting for post to load for profile ${
                      i + 1
                    }`,
                    key: "uploading",
                  });
                }
                message.info({
                  key: "uploading",
                  content: "Selecting the first post",
                });
                const post = await page.$(`div[aria-posinset="1"]`);
                message.info({
                  key: "uploading",
                  content: "Getting comments",
                });
                const divspans =
                  (await post?.$$(
                    `div[role="button"][tabindex="0"] > span[dir="auto"]`
                  )) || [];
                const allCommentsSelectorToggler = divspans[2];
                await allCommentsSelectorToggler?.click();
                await page?.waitForSelector(`div[role="menu"]`);
                const allCommentsMenuSeletorMenu = await page?.$(
                  `div[role="menu"]`
                );
                const allCommentsMenuSeletorMenuItems =
                  await allCommentsMenuSeletorMenu?.$$(`div[role="menuitem"]`);
                const allCommentsItem =
                  allCommentsMenuSeletorMenuItems![
                    allCommentsMenuSeletorMenuItems!.length - 1
                  ];
                await allCommentsItem?.click();
                await post?.waitForSelector(`div[role="article"]`);
                // click on the following button then then it will disapper but if they're still more comments it will be there(just continue clicking on it)
                let moreComments = await post?.$(
                  `div.x78zum5.x13a6bvl.xexx8yu.x1pi30zi.x18d9i69.x1swvt13.x1n2onr6 > div.x78zum5.x1iyjqo2.x21xpn4.x1n2onr6`
                );

                while (moreComments) {
                  await moreComments?.click();
                  await page?.waitForTimeout(3000);
                  moreComments = await post?.$(
                    `div.x78zum5.x13a6bvl.xexx8yu.x1pi30zi.x18d9i69.x1swvt13.x1n2onr6 > div.x78zum5.x1iyjqo2.x21xpn4.x1n2onr6`
                  );
                }

                const comments = await post?.$$(`div[role="article"]`);
                if (!comments) {
                  message.error({
                    content: `Error getting comments for profile ${i + 1}`,
                    key: "uploading",
                  });
                  return;
                }
                if (comments.length === 0) {
                  message.error({
                    content: `No comments found to react to for profile ${
                      i + 1
                    }`,
                    key: "uploading",
                  });
                  return;
                }
                for (let i = 0; i < comments.length; i++) {
                  const comment = comments[i];
                  // check if comment is already liked, given Love, Care, Haha to it
                  let givenReaction = false;
                  message.info({
                    key: "uploading",
                    content: `Checking if comment ${i + 1} has been reacted on`,
                  });
                  for (let i = 0; i < reactions.length; i++) {
                    try {
                      const reaction = reactions[i];
                      const reactionButton = await comment.$(
                        `div[aria-label="Remove ${reaction}"][role="button"]`
                      );
                      if (reactionButton) {
                        givenReaction = true;
                        break;
                      }
                    } catch (error) {
                      continue;
                    }
                  }
                  if (!givenReaction) {
                    message.info({
                      key: "uploading",
                      content: `Reacting to comment ${i + 1}`,
                    });

                    const like = await comment.$(
                      `div[aria-label="Like"][role="button"]`
                    );
                    if (!like) {
                      message.error({
                        content: `Error getting like button for comment ${
                          i + 1
                        } for profile ${i + 1}`,
                        key: "uploading",
                      });
                      return;
                    }
                    await like?.hover();
                    await page.waitForSelector(
                      `div[aria-label="Reactions"][role="dialog"]`,
                      {
                        timeout: 0,
                      }
                    );
                    const reactionsDialog = await page.$(
                      `div[aria-label="Reactions"][role="dialog"]`
                    );
                    const reactionButtons = await reactionsDialog?.$$(
                      "div[role='button']"
                    );
                    // random index(60 % chance of liking, 40 % chance of other reactions)

                    const randomIndex =
                      Math.floor(Math.random() * 10) < 6
                        ? 0
                        : Math.floor(Math.random() * 4) + 1;
                    // console.log(randomIndex);
                    await reactionButtons![randomIndex].click();
                  }
                }
                message.success({
                  content: `Successfully reacted to all comments for profile ${
                    i + 1
                  }`,
                  key: "uploading",
                });
                // delete file(data.csv)
              } catch (error) {
                console.log(error);
                message.error({
                  content: `Error reacting to comments for profile ${i + 1}`,
                  key: "uploading",
                });
              }
            })
            .catch((error: any) => {
              console.log(error);
              message.error({
                content: `Error opening browser for profile ${i + 1}`,
                key: "uploading",
              });
            });
        }
      } catch (error) {
        console.log(error);
        message.error({
          key: "uploading",
          content: "Error ",
        });
      }
    } catch (error) {
      message.error({
        content: "Error importing data ",
        key: "uploading",
      });
      return;
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center max-w-md mx-auto">
      <Form
        onFinish={(values) => {
          submit({ ...values, csv: values.csv.file });
        }}
        layout="vertical"
        className="bg-white shadow-xl rounded-md px-8 pt-6 pb-8 mb-4"
      >
        <h1 className="text-2xl font-bold mb-4">Facebook Bot</h1>
        <Form.Item
          // check if the input is facebook post link
          rules={[
            {
              required: true,
              message: "Please input post link!",
            },
            {
              pattern: new RegExp(
                // regex for facebook post link
                "^(https?:\\/\\/)?" +
                  "(www\\.)?" +
                  "(m\\.)?" +
                  "(web\\.)?" +
                  "facebook.com\\/" +
                  "[a-zA-Z0-9\\.\\-\\_\\/]+" +
                  "\\/posts\\/" +
                  "[0-9]" +
                  "??[a-zA-Z0-9=&%]+"
              ),
              message: "Enter valid post link!",
            },
          ]}
          name="post"
          label="Post link"
        >
          <Input allowClear />
        </Form.Item>
        {/* Upload .csv */}
        <Form.Item name="csv">
          <Dragger
            multiple={false}
            accept=".csv"
            beforeUpload={(file) => {
              setCsv(file);
              return false;
            }}
            maxCount={1}
            onRemove={() => setCsv(null)}
          >
            <p className="ant-upload-drag-icon mx-auto w-fit">
              <BsFillInboxesFill className="w-fit" size={28} color="#1b1ba0" />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to upload
            </p>
            <p className="ant-upload-hint">
              Support for a single or bulk upload. Strictly prohibited from
              uploading company data or other banned files.
            </p>
          </Dragger>
        </Form.Item>
        {/*  he can pick time he wants just select if the given time is in hours, minutes, seconds or milleseconds */}
        <Form.Item
          name="time"
          label="Time Delay"
          rules={[
            {
              required: true,
              message: "Please select time interval!",
            },
          ]}
        >
          <Input allowClear type="number" min={1} max={100000} />
        </Form.Item>
        <Form.Item
          name="timeType"
          rules={[
            {
              required: true,
              message: "Please select time interval type!",
            },
          ]}
        >
          <Select placeholder="Select time interval type">
            <Select.Option value="hours">Hours</Select.Option>
            <Select.Option value="minutes">Minutes</Select.Option>
            <Select.Option value="seconds">Seconds</Select.Option>
            <Select.Option value="milliseconds">Milliseconds</Select.Option>
          </Select>
        </Form.Item>
        <Button
          type="primary"
          className="w-full bg-[#1b1ba0] mt-4 disabled:bg-[#ccc]"
          htmlType="submit"
          disabled={!csv}
        >
          Start
        </Button>
      </Form>
    </div>
  );
}

export default App;
