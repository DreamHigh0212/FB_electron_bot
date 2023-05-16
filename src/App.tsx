import { useState } from "react";
import { Button, Form, Input, message, Upload } from "antd";
import { RcFile } from "antd/es/upload";
import { BsFillInboxesFill } from "react-icons/bs";
import Playwright from "playwright";
import Electron from "electron";
const fs = window.require("fs");
const playwright = window.require("playwright");
const csv = window.require("csv-parser");
const { ipcRenderer }: { ipcRenderer: Electron.IpcRenderer } =
  window.require("electron");
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
  const submit = async (values: { csv: RcFile; post: string }) => {
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
      message.error({ content: "Error uploading csv", key: "uploading" });
      console.log(error);
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
              content: `Error Logging in for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let cookies = csvData[i]["Cookies:"];
          if (!cookies) {
            message.error({
              content: `Error Logging in for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let proxyserver = csvData[i]["Proxy HTTP"];
          let proxyusername = csvData[i]["proxyusername"];
          let proxypassword = csvData[i]["proxy password"];
          const browser = await playwright.chromium.launch({
            // headless: false,
            proxy: {
              server: proxyserver,
              username: proxyusername,
              password: proxypassword,
            },
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
                    waitUntil: "networkidle",
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
                  await page.waitForSelector(`div[aria-posinset="1"]`);
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
                  await page.waitForTimeout(2000);
                  await page.waitForSelector(
                    `div[aria-label="Reactions"][role="dialog"]`
                  );
                  const reactionsDialog = await page.$(
                    `div[aria-label="Reactions"][role="dialog"]`
                  );
                  const reactionButtons = await reactionsDialog?.$$(
                    "div[role='button']"
                  );
                  const randomIndex = Math.floor(
                    Math.random() * reactions.length
                  );
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
                await commentBox?.type(csvData[i]["Post"]);
                await page.keyboard.press("Enter");
                message.info({
                  content: "Logging out",
                  key: "uploading",
                });
                await page.waitForTimeout(3000);
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

        message.success({
          content: "Successfully commented on post and liked it",
          key: "uploading",
        });

        for (let i = 0; i <= csvData.length; i++) {
          message.loading({
            content: `Logging in for profile ${i + 1}`,
            key: "uploading",
          });
          if (!csvData[i]) {
            message.error({
              content: `Error Logging in for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let cookies = csvData[i]["Cookies:"];
          if (!cookies) {
            message.error({
              content: `Error Logging in for profile  ${i + 1}`,
              key: "uploading",
            });
            continue;
          }
          let proxyserver = csvData[i]["Proxy HTTP"];
          let proxyusername = csvData[i]["proxyusername"];
          let proxypassword = csvData[i]["proxy password"];
          const browser = await playwright.chromium.launch({
            // headless: false,
            proxy: {
              server: proxyserver,
              username: proxyusername,
              password: proxypassword,
            },
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
                    waitUntil: "networkidle",
                  });
                } catch (error) {
                  message.error({
                    content: `Error Opening the post for profile ${i + 1}`,
                    key: "uploading",
                  });
                }
                const reactions = ["Like", "Love", "Care", "Haha", "Wow"];
                try {
                  await page.waitForSelector(`div[aria-posinset="1"]`);
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
                const comments = await post?.$$(`div[role="article"]`);
                if (!comments || comments.length === 0) {
                  message.error({
                    content: `Error getting comments for profile ${i + 1}`,
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
                    await page.waitForTimeout(2000);
                    await page.waitForSelector(
                      `div[aria-label="Reactions"][role="dialog"]`
                    );
                    const reactionsDialog = await page.$(
                      `div[aria-label="Reactions"][role="dialog"]`
                    );
                    const reactionButtons = await reactionsDialog?.$$(
                      "div[role='button']"
                    );
                    const randomIndex = Math.floor(
                      Math.random() * reactions.length
                    );

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
                ipcRenderer.send("error-on", i + 1);
              }
            })
            .catch((error: any) => {
              console.log(error);
              ipcRenderer.send("login-reply", {
                message: "error",
                profile: i + 1,
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

  ipcRenderer.on("error", (_: any, __: any) => {
    // setStarted(false);
    message.error({
      content: "Something went wrong",
      key: "uploading",
    });
  });

  ipcRenderer.on("error-on", (_: any, arg: any) => {
    // setStarted(false);
    message.error({
      content: "Something went wrong with profile " + arg,
      key: "uploading",
    });
  });

  ipcRenderer.on("noitification", (_: any, arg: any) => {
    if (arg === "finished") {
      // setStarted(false);
      message.success({
        content: "Finished",
        key: "uploading",
      });
    } else {
      message.info({
        content: arg,
        key: "uploading",
      });
    }
  });

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
        {/* Input post */}
        <Form.Item
          // check if the input is facebook post link
          rules={[
            {
              required: true,
              message: "Please input post link!",
            },
            {
              pattern: new RegExp(
                "^(https?:\\/\\/)?" +
                  "(www\\.)?" +
                  // may be from web or mobile
                  "(m\\.)?" +
                  "(web\\.)?" +
                  "facebook.com\\/" +
                  "[a-zA-Z0-9\\.\\-\\_\\/]+" +
                  "\\/posts\\/" +
                  "[0-9]" +
                  "??[a-zA-Z0-9=&%]+"
                // may have some query params (example: ?_rdc=1&_rdr)                  // may have some query params (example: ?_rdc=1&_rdr)
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
