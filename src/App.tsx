import { useState } from "react";
import { Button, Form, Input, message, Select, Upload } from "antd";
import { RcFile } from "antd/es/upload";
import { BsFillInboxesFill } from "react-icons/bs";
import Playwright from "playwright";
import Papa from 'papaparse';
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

function App() {
  const [csv, setCsv] = useState<RcFile | null>(null);
  // const [started, setStarted] = useState(false);
  const submit = async (values: {
    csv: RcFile;
    post: string;
    time: string;
    timeType: "hours" | "minutes" | "seconds" | "milliseconds";
  }) => {
    // setStarted(true);

    message.loading({ content: "Importing data", key: "uploading" });
    // import data
    try {

      const csvData = await getDataFromCsvAsArray(csv!);
      message.success({ content: "Imported data", key: "uploading" });
      try {
        for (let i = 0; i < csvData.length; i++) {
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
                    waitUntil: "load",
                    timeout: 0,
                  });
                } catch (error) {
                  message.error({
                    content: `Error Opening the post for profile ${i + 1}`,
                    key: "uploading",
                  });
                }
                const reactions = ["Like", "Love", "Care", "Wow"];
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
                    content: `Error Waiting for post to load for profile ${i + 1
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
                  await reactionButtons![randomIndex === 3 ? 4 : randomIndex]?.click();
                }
                message.info({
                  key: "uploading",
                  content: "Commenting on the post",
                });

                const commentBox = await post?.$(
                  `div[aria-label="Write a comment"][role="textbox"]`
                );
                await commentBox?.click();
                let posts = csvData[i]["Post"].split("\n");
                await commentBox?.type(posts[0], { delay: 40 });
                await page.keyboard.press("Enter");
                while (true) {
                  try {
                    let autoSpans = await post?.$$(`span[dir="auto"]`);
                    let postingSpans = [];
                    for (let i = 0; i < autoSpans!.length; i++) {
                      let posting = await autoSpans![i].innerText();
                      if (posting === "Posting...") {
                        postingSpans.push(autoSpans![i])
                      }
                    }
                    if (postingSpans.length > 0) {
                      await page.waitForTimeout(1000);
                    } else {
                      break;
                    }
                  } catch (error) {
                    break;
                  }
                }
                await browser.close();
                message.success({
                  content: "Successfully commented on post and liked it",
                  key: "uploading",
                });
                // set a timeout before the new index starts 
                await new Promise((resolve) => setTimeout(resolve, values.timeType === "hours" ?
                  Number(values.time) * 60 * 60 * 1000 :
                  values.timeType === "minutes" ?
                    Number(values.time) * 60 * 1000 :
                    Number(values.time) * 1000));
                // await the comment to be posted
              } catch (error) {
                console.log(error);
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

        for (let i = 0; i < csvData.length; i++) {
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
                    waitUntil: "load",
                    timeout: 0,
                  });
                } catch (error) {
                  message.error({
                    content: `Error Opening the post for profile ${i + 1}`,
                    key: "uploading",
                  });
                }
                const reactions = ["Like", "Love", "Care", "Wow"];
                try {
                  await page.waitForSelector(`div[aria-posinset="1"]`, {
                    timeout: 0,
                  });
                } catch {
                  message.error({
                    content: `Error Waiting for post to load for profile ${i + 1
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
                const allCommentsSelectorToggler =
                  await post?.$(
                    `div.x6s0dn4.x78zum5.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xe0p6wg > div[role="button"][tabindex="0"] > span[dir="auto"]`
                  );
                await allCommentsSelectorToggler!.click();
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
                while (true) {
                  try {
                    let eleme = await post?.$(`div.x78zum5.x13a6bvl.xexx8yu.x1pi30zi.x18d9i69.x1swvt13.x1n2onr6 > div.x78zum5.x1iyjqo2.x21xpn4.x1n2onr6`);
                    if (!eleme) {
                      break;
                    }
                    await eleme!.click();
                  } catch {
                    break;
                  }
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
                    content: `No comments found to react to for profile ${i + 1
                      }`,
                    key: "uploading",
                  });
                  return;
                }

                // the comments must be liked at random too.
                const commentsToBeLiked: number[] = [];
                let minMumOfCommentsToBeLiked = 5;
                let maxMumOfCommentsToBeLiked = csvData.length;

                if (minMumOfCommentsToBeLiked > maxMumOfCommentsToBeLiked) {
                  minMumOfCommentsToBeLiked = maxMumOfCommentsToBeLiked;
                }

                if (maxMumOfCommentsToBeLiked > comments.length) {
                  maxMumOfCommentsToBeLiked = comments.length;
                }
                let randomNumberOfCommentsTobeLiked = Math.floor(
                  Math.random() *
                  (maxMumOfCommentsToBeLiked - minMumOfCommentsToBeLiked + 1) +
                  minMumOfCommentsToBeLiked
                );

                while (commentsToBeLiked.length < randomNumberOfCommentsTobeLiked) {
                  const randomCommentIndex = Math.floor(
                    Math.random() * comments.length
                  );
                  if (!commentsToBeLiked.includes(randomCommentIndex)) {
                    commentsToBeLiked.push(randomCommentIndex);
                  }
                }
                for (let i = 0; i < comments.length; i++) {
                  // const comment = comments[i];
                  if (commentsToBeLiked.includes(i)) {
                    const comment = comments[i];
                    // check if comment is already liked, given Love, Care to it
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
                    if (givenReaction) {
                      continue;
                    }
                    if (commentsToBeLiked.includes(i)) {
                      message.info({
                        key: "uploading",
                        content: `Reacting to comment ${i + 1}`,
                      });
                      const like = await comment.$(
                        `div[aria-label="Like"][role="button"]`
                      );
                      if (!like) {
                        message.error({
                          content: `Error getting like button for comment ${i + 1
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
                      const randomIndex =
                        Math.floor(Math.random() * 10) < 6
                          ? 0
                          : Math.floor(Math.random() * 4) + 1;
                      await reactionButtons![randomIndex === 3 ? 4 : randomIndex].click();
                      await page.waitForTimeout(1000);
                    }
                  }
                }

                message.success({
                  content: `Successfully reacted to all comments for profile ${i + 1
                    }`,
                  key: "uploading",
                });
                await page?.waitForTimeout(3000);
                await browser.close();
                message.success({
                  content: "Successfully commented on post and liked it",
                  key: "uploading",
                });
                await new Promise((resolve) => setTimeout(resolve, values.timeType === "hours" ?
                  Number(values.time) * 60 * 60 * 1000 :
                  values.timeType === "minutes" ?
                    Number(values.time) * 60 * 1000 :
                    Number(values.time) * 1000));
              } catch (error) {
                console.log(error);
                message.error({
                  content: `Error reacting to comments for profile ${i + 1}`,
                  key: "uploading",
                });
              }
            })
            .catch((error: any) => {
              // console.log(error);
              message.error({
                content: `Error opening browser for profile ${i + 1}`,
                key: "uploading",
              });
            });
        }
      } catch (error) {
        // console.log(error);
        message.error({
          key: "uploading",
          content: "Error ",
        });
      }
    } catch (error) {
      // console.log(error)
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
          initialValue={0}
          rules={[
            {
              required: true,
              message: "Please select time interval!",
            },
          ]}
        >
          <Input
            allowClear
            type="number"
            min={0}
            max={100000}
          />
        </Form.Item>
        <Form.Item
          name="timeType"
          initialValue={"milliseconds"}
          rules={[
            {
              required: true,
              message: "Please select time interval type!",
            },
          ]}
        >
          <Select
            defaultValue={"milliseconds"}
            placeholder="Select time interval type"
          >
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
